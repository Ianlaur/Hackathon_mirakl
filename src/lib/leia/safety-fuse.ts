import { prisma } from '@/lib/prisma'
import { createDecisionLedgerEntry } from '@/lib/leia/ledger'
import { calculateReturnRate } from '@/lib/leia/tools-math'

export type SafetyFuseMetric = 'return_rate' | 'damage_rate' | 'loss_rate'

export type SafetyFuseTrip = {
  sku: string
  metric: SafetyFuseMetric
  action: 'propose_pause' | 'auto_pause' | 'propose_investigation'
  status: 'proposed' | 'auto_executed'
  templateId: 'fuse_tripped_v1'
  thresholdPct: number
  ratePct: number
  sampleSize: number
  templateInput: {
    sku: string
    return_rate_pct: number
    sample_size: number
    threshold_pct: number
    trip_stage: string
  }
}

const FUSE_RULES: Record<
  SafetyFuseMetric,
  { thresholdPct: number; minSample: number; firstAction: SafetyFuseTrip['action'] }
> = {
  return_rate: { thresholdPct: 30, minSample: 10, firstAction: 'propose_pause' },
  damage_rate: { thresholdPct: 15, minSample: 10, firstAction: 'propose_pause' },
  loss_rate: { thresholdPct: 10, minSample: 20, firstAction: 'propose_investigation' },
}

export function evaluateSafetyFuse(args: {
  sku: string
  metric: SafetyFuseMetric
  numerator: number
  denominator: number
  previousTripsWithin7Days: number
}): SafetyFuseTrip | null {
  const rule = FUSE_RULES[args.metric]
  if (!rule || args.denominator < rule.minSample) return null

  const ratePct = calculateReturnRate(args.numerator, args.denominator)
  if (ratePct <= rule.thresholdPct) return null

  const repeated = args.previousTripsWithin7Days > 0 && args.metric !== 'loss_rate'
  const action = repeated ? 'auto_pause' : rule.firstAction
  const status = repeated ? 'auto_executed' : 'proposed'
  const tripStage =
    action === 'auto_pause'
      ? 'Second trip within 7 days - auto-pausing.'
      : action === 'propose_investigation'
        ? 'Variance threshold exceeded - proposing investigation.'
        : 'First trip - proposing pause.'

  return {
    sku: args.sku,
    metric: args.metric,
    action,
    status,
    templateId: 'fuse_tripped_v1',
    thresholdPct: rule.thresholdPct,
    ratePct,
    sampleSize: args.denominator,
    templateInput: {
      sku: args.sku,
      return_rate_pct: ratePct,
      sample_size: args.denominator,
      threshold_pct: rule.thresholdPct,
      trip_stage: tripStage,
    },
  }
}

export async function countRecentFuseTrips(userId: string, sku: string, metric: SafetyFuseMetric) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
    SELECT COUNT(*) AS count
    FROM public.decision_ledger
    WHERE user_id = ${userId}::uuid
      AND sku = ${sku}
      AND template_id = 'fuse_tripped_v1'
      AND raw_payload->>'metric' = ${metric}
      AND created_at >= now() - interval '7 days'
  `

  return Number(rows[0]?.count ?? 0)
}

export async function createSafetyFuseTrip(userId: string, trip: SafetyFuseTrip) {
  return createDecisionLedgerEntry({
    userId,
    sku: trip.sku,
    actionType: trip.action,
    templateId: trip.templateId,
    templateInput: trip.templateInput,
    rawPayload: {
      metric: trip.metric,
      threshold_pct: trip.thresholdPct,
      rate_pct: trip.ratePct,
      sample_size: trip.sampleSize,
    },
    status: trip.status,
    reversible: true,
    sourceAgent: 'leia',
    triggeredBy: 'safety_fuse',
  })
}

type FuseScanRow = {
  sku: string
  orders_count: number
  returns_count: number
  damage_count: number
}

export async function runSafetyFuseScanForUser(userId: string) {
  const rows = await prisma.$queryRaw<FuseScanRow[]>`
    WITH orders AS (
      SELECT sku, COALESCE(SUM(COALESCE(quantity, 1)), 0)::int AS orders_count
      FROM public.operational_objects
      WHERE user_id = ${userId}::uuid
        AND kind IN ('order', 'orders')
        AND sku IS NOT NULL
        AND occurred_at >= now() - interval '30 days'
      GROUP BY sku
    ),
    returns AS (
      SELECT
        sku,
        COUNT(*)::int AS returns_count,
        COUNT(*) FILTER (
          WHERE lower(COALESCE(raw_payload->>'reason_code', raw_payload->>'reason', raw_payload->>'return_reason', ''))
            ~ '(damage|damaged|broken|defect|defective)'
        )::int AS damage_count
      FROM public.operational_objects
      WHERE user_id = ${userId}::uuid
        AND kind IN ('return', 'returns')
        AND sku IS NOT NULL
        AND occurred_at >= now() - interval '30 days'
      GROUP BY sku
    )
    SELECT
      orders.sku,
      orders.orders_count,
      COALESCE(returns.returns_count, 0)::int AS returns_count,
      COALESCE(returns.damage_count, 0)::int AS damage_count
    FROM orders
    LEFT JOIN returns ON returns.sku = orders.sku
  `

  const created = []
  for (const row of rows) {
    for (const metric of ['return_rate', 'damage_rate'] as const) {
      const previousTripsWithin7Days = await countRecentFuseTrips(userId, row.sku, metric)
      const trip = evaluateSafetyFuse({
        sku: row.sku,
        metric,
        numerator: metric === 'return_rate' ? row.returns_count : row.damage_count,
        denominator: row.orders_count,
        previousTripsWithin7Days,
      })
      if (
        trip &&
        (previousTripsWithin7Days === 0 ||
          (previousTripsWithin7Days === 1 && trip.action === 'auto_pause'))
      ) {
        created.push(await createSafetyFuseTrip(userId, trip))
      }
    }
  }

  return created
}
