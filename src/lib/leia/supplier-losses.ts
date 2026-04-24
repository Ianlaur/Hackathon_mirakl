import supplierCatalog from '@/config/suppliers.mock.json'
import { createDecisionLedgerEntry } from '@/lib/leia/ledger'
import { evaluateFounderPolicy } from '@/lib/leia/policy'
import { calculateReturnRate, calculateSupplierLossCost } from '@/lib/leia/tools-math'
import { prisma } from '@/lib/prisma'

export const SUPPLIER_LOSS_TYPES = [
  'delivery_short',
  'defective_batch',
  'late_delivery',
  'wrong_item',
  'damaged_in_transit',
] as const

export const SUPPLIER_RECOVERY_STATUSES = [
  'not_claimed',
  'claim_sent',
  'claim_accepted',
  'claim_rejected',
  'recovered',
] as const

export type SupplierLossType = (typeof SUPPLIER_LOSS_TYPES)[number]
export type SupplierRecoveryStatus = (typeof SUPPLIER_RECOVERY_STATUSES)[number]

type SupplierCatalogEntry = {
  supplier_name: string
  sku: string
  unit_cost_eur: number
  lead_time_days?: number
  moq?: number
  mocked?: boolean
}

export type SupplierLossDeclarationInput = {
  userId: string
  supplier_name: string
  sku: string
  loss_type: SupplierLossType
  quantity: number
  notes?: string | null
}

export type SupplierLossDeclarationResult = {
  ok: true
  loss_id: string
  decision_id: string | null
  status: string
  supplier_name: string
  sku: string
  loss_type: SupplierLossType
  quantity_impacted: number
  unit_cost_eur: number
  estimated_cost_eur: number
  supplier_loss_count_90d: number
  defect_rate_pct: number
  reasoning: string
  next_step: 'claim_email' | 'switch_supplier' | 'log_only'
}

export type RadarSupplierScorecard = {
  supplier_name: string
  total_losses_90d: number
  total_orders_90d: number
  loss_rate_pct: number
  estimated_recovery_potential_eur: number
  recovery_status: SupplierRecoveryStatus | 'mixed'
  recovery_statuses: Record<string, number>
}

export type RadarSnapshot = {
  profit_recovery: {
    carrier_audit_savings_eur: number
    supplier_recovery_potential_eur: number
    total_eur: number
  }
  carrier_audits: Array<{
    sku: string
    carrier: string
    damage_rate_pct: number
    estimated_savings_eur: number
    simulated: boolean
  }>
  supplier_scorecards: RadarSupplierScorecard[]
}

const catalog = supplierCatalog as SupplierCatalogEntry[]

function normalize(value: string) {
  return value.trim().toLowerCase()
}

function roundMoney(value: number) {
  return Number(value.toFixed(2))
}

function pickNextStep(count90d: number, defectRatePct: number): SupplierLossDeclarationResult['next_step'] {
  if (count90d >= 3 || defectRatePct >= 5) return 'switch_supplier'
  if (count90d >= 1) return 'claim_email'
  return 'log_only'
}

export async function ensureSupplierLossesTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS public.supplier_losses (
      loss_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      timestamp TIMESTAMPTZ DEFAULT now(),
      supplier_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      loss_type TEXT NOT NULL CHECK (
        loss_type IN (
          'delivery_short',
          'defective_batch',
          'late_delivery',
          'wrong_item',
          'damaged_in_transit'
        )
      ),
      quantity_impacted INT NOT NULL,
      estimated_cost_eur NUMERIC NOT NULL,
      recovery_status TEXT NOT NULL CHECK (
        recovery_status IN (
          'not_claimed',
          'claim_sent',
          'claim_accepted',
          'claim_rejected',
          'recovered'
        )
      ) DEFAULT 'not_claimed',
      notes TEXT,
      decision_id UUID REFERENCES public.decision_ledger(id)
    )
  `

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_supplier_losses_supplier_timestamp
    ON public.supplier_losses (supplier_name, timestamp DESC)
  `

  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS idx_supplier_losses_decision_id
    ON public.supplier_losses (decision_id)
  `
}

async function findSupplierUnitCost(args: {
  userId: string
  supplierName: string
  sku: string
}) {
  const supplierKey = normalize(args.supplierName)
  const skuKey = normalize(args.sku)
  const exactCatalogEntry = catalog.find(
    (entry) =>
      normalize(entry.supplier_name) === supplierKey &&
      normalize(entry.sku) === skuKey &&
      Number.isFinite(Number(entry.unit_cost_eur))
  )
  if (exactCatalogEntry) return Number(exactCatalogEntry.unit_cost_eur)

  const skuCatalogEntry = catalog.find(
    (entry) => normalize(entry.sku) === skuKey && Number.isFinite(Number(entry.unit_cost_eur))
  )
  if (skuCatalogEntry) return Number(skuCatalogEntry.unit_cost_eur)

  const product = await prisma.product.findFirst({
    where: {
      user_id: args.userId,
      sku: { equals: args.sku, mode: 'insensitive' },
    },
    select: {
      supplier_unit_cost_eur: true,
      purchase_price: true,
    },
  })

  return Number(product?.supplier_unit_cost_eur ?? product?.purchase_price ?? 0)
}

async function countSupplierLosses90d(supplierName: string) {
  await ensureSupplierLossesTable()
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM public.supplier_losses
    WHERE lower(supplier_name) = lower(${supplierName})
      AND timestamp >= now() - INTERVAL '90 days'
  `

  return Number(rows[0]?.count ?? 0)
}

async function countOrders90dForSupplier(userId: string, supplierName: string, fallbackSku?: string) {
  const products = await prisma.product.findMany({
    where: {
      user_id: userId,
      supplier: { equals: supplierName, mode: 'insensitive' },
      active: true,
    },
    select: { sku: true },
  })
  const skus = products.map((product) => product.sku).filter((sku): sku is string => Boolean(sku))
  if (fallbackSku && !skus.some((sku) => normalize(sku) === normalize(fallbackSku))) {
    skus.push(fallbackSku)
  }

  if (skus.length === 0) return 0

  const rows = await prisma.operationalObject.findMany({
    where: {
      user_id: userId,
      kind: { in: ['order', 'orders'] },
      occurred_at: { gte: new Date(Date.now() - 90 * 24 * 3600 * 1000) },
      sku: { in: skus },
    },
    select: { quantity: true },
  })

  return rows.reduce((sum, row) => {
    const quantity = Number(row.quantity)
    return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1)
  }, 0)
}

export async function declareSupplierLoss(
  input: SupplierLossDeclarationInput
): Promise<SupplierLossDeclarationResult> {
  await ensureSupplierLossesTable()

  const supplierName = input.supplier_name.trim()
  const sku = input.sku.trim()
  const quantityImpacted = Math.max(1, Math.trunc(Number(input.quantity) || 0))
  const unitCost = await findSupplierUnitCost({
    userId: input.userId,
    supplierName,
    sku,
  })
  const estimatedCost = calculateSupplierLossCost(unitCost, quantityImpacted)
  const previousLossCount90d = await countSupplierLosses90d(supplierName)
  const supplierLossCount90d = previousLossCount90d + 1
  const totalOrders90d = await countOrders90dForSupplier(input.userId, supplierName, sku)
  const defectRatePct = calculateReturnRate(supplierLossCount90d, totalOrders90d)
  const nextStep = pickNextStep(supplierLossCount90d, defectRatePct)

  const [founderState, autonomy] = await Promise.all([
    prisma.founderState.findUnique({ where: { user_id: input.userId } }),
    prisma.autonomyConfig.findUnique({
      where: { user_id_action_type: { user_id: input.userId, action_type: 'supplier_loss' } },
    }),
  ])
  const policy = evaluateFounderPolicy({
    autonomyMode: autonomy?.mode ?? 'auto_execute',
    founderState: founderState?.state ?? 'Available',
    reversible: true,
  })

  const templateInput = {
    supplier: supplierName,
    quantity: quantityImpacted,
    sku,
    loss_type: input.loss_type,
    cost: estimatedCost,
    count: supplierLossCount90d,
    rate: defectRatePct,
  }

  const ledger = policy.writeLedger
    ? await createDecisionLedgerEntry({
        userId: input.userId,
        sku,
        actionType: 'supplier_loss',
        templateId: 'supplier_loss_v1',
        templateInput,
        rawPayload: {
          request: {
            action_type: 'supplier_loss',
            supplier_name: supplierName,
            sku,
            loss_type: input.loss_type,
            quantity: quantityImpacted,
            notes: input.notes ?? null,
          },
          supplier_loss: {
            unit_cost_eur: unitCost,
            estimated_cost_eur: estimatedCost,
            supplier_loss_count_90d: supplierLossCount90d,
            defect_rate_pct: defectRatePct,
            next_step: nextStep,
          },
          policy: { route: policy.route, status: policy.status },
        },
        status: policy.status,
        reversible: true,
        sourceAgent: 'leia',
        triggeredBy: 'chat',
      })
    : null

  const rows = await prisma.$queryRaw<Array<{ loss_id: string }>>`
    INSERT INTO public.supplier_losses (
      supplier_name,
      sku,
      loss_type,
      quantity_impacted,
      estimated_cost_eur,
      recovery_status,
      notes,
      decision_id
    ) VALUES (
      ${supplierName},
      ${sku},
      ${input.loss_type},
      ${quantityImpacted},
      ${estimatedCost},
      'not_claimed',
      ${input.notes ?? null},
      ${ledger?.id ?? null}::uuid
    )
    RETURNING loss_id::text
  `

  return {
    ok: true,
    loss_id: rows[0].loss_id,
    decision_id: ledger?.id ?? null,
    status: ledger?.status ?? policy.status,
    supplier_name: supplierName,
    sku,
    loss_type: input.loss_type,
    quantity_impacted: quantityImpacted,
    unit_cost_eur: roundMoney(unitCost),
    estimated_cost_eur: estimatedCost,
    supplier_loss_count_90d: supplierLossCount90d,
    defect_rate_pct: defectRatePct,
    reasoning:
      ledger?.logical_inference ??
      `Supplier loss declared: ${supplierName} (${input.loss_type}) for ${quantityImpacted} units of ${sku}.`,
    next_step: nextStep,
  }
}

function summarizeRecoveryStatus(statuses: Record<string, number>) {
  const entries = Object.entries(statuses).filter(([, count]) => count > 0)
  return entries.length === 1 ? (entries[0][0] as SupplierRecoveryStatus) : 'mixed'
}

export async function getRadarSnapshot(userId: string): Promise<RadarSnapshot> {
  await ensureSupplierLossesTable()

  const rows = await prisma.$queryRaw<
    Array<{
      supplier_name: string
      recovery_status: SupplierRecoveryStatus
      total_losses: number
      estimated_cost_eur: unknown
      not_claimed_eur: unknown
    }>
  >`
    SELECT
      supplier_name,
      recovery_status,
      COUNT(*)::int AS total_losses,
      COALESCE(SUM(estimated_cost_eur), 0) AS estimated_cost_eur,
      COALESCE(SUM(CASE WHEN recovery_status = 'not_claimed' THEN estimated_cost_eur ELSE 0 END), 0) AS not_claimed_eur
    FROM public.supplier_losses
    WHERE timestamp >= now() - INTERVAL '90 days'
    GROUP BY supplier_name, recovery_status
    ORDER BY supplier_name ASC, recovery_status ASC
  `

  const bySupplier = new Map<
    string,
    {
      total_losses_90d: number
      estimated_recovery_potential_eur: number
      statuses: Record<string, number>
    }
  >()

  for (const row of rows) {
    const current =
      bySupplier.get(row.supplier_name) ??
      {
        total_losses_90d: 0,
        estimated_recovery_potential_eur: 0,
        statuses: {},
      }
    current.total_losses_90d += Number(row.total_losses ?? 0)
    current.estimated_recovery_potential_eur += Number(row.not_claimed_eur ?? 0)
    current.statuses[row.recovery_status] =
      (current.statuses[row.recovery_status] ?? 0) + Number(row.total_losses ?? 0)
    bySupplier.set(row.supplier_name, current)
  }

  const supplierScorecards: RadarSupplierScorecard[] = []
  for (const [supplierName, value] of Array.from(bySupplier.entries())) {
    const totalOrders = await countOrders90dForSupplier(userId, supplierName)
    supplierScorecards.push({
      supplier_name: supplierName,
      total_losses_90d: value.total_losses_90d,
      total_orders_90d: totalOrders,
      loss_rate_pct: calculateReturnRate(value.total_losses_90d, totalOrders),
      estimated_recovery_potential_eur: roundMoney(value.estimated_recovery_potential_eur),
      recovery_status: summarizeRecoveryStatus(value.statuses),
      recovery_statuses: value.statuses,
    })
  }

  const supplierRecoveryPotential = roundMoney(
    supplierScorecards.reduce((sum, row) => sum + row.estimated_recovery_potential_eur, 0)
  )
  const carrierAuditSavings = 0

  return {
    profit_recovery: {
      carrier_audit_savings_eur: carrierAuditSavings,
      supplier_recovery_potential_eur: supplierRecoveryPotential,
      total_eur: roundMoney(carrierAuditSavings + supplierRecoveryPotential),
    },
    carrier_audits: [],
    supplier_scorecards: supplierScorecards.sort(
      (left, right) => right.estimated_recovery_potential_eur - left.estimated_recovery_potential_eur
    ),
  }
}
