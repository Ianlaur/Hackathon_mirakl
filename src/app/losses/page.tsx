import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getCurrentUserId } from '@/lib/session'
import LossesPageClient, { LossEvent } from './LossesPageClient'

export const dynamic = 'force-dynamic'

type DbLossEvent = {
  id: string
  occurred_at: Date
  detected_at: Date
  source_table: string | null
  source_line: number | null
  source_order_ref: string | null
  product_catalog_id: string | null
  sku: string
  product_name: string
  category: string | null
  quantity_lost: number
  ordered_quantity: number | null
  unit_cost: string | null
  order_unit_price: string | null
  estimated_loss_value: string | null
  detected_stage: string
  location_label: string | null
  reason_category: string
  reason_detail: string | null
  confidence: string
  status: string
  carrier_name: string | null
  marketplace: string | null
  supplier_name: string | null
  notes: string | null
  created_at: Date
  updated_at: Date
}

function toNumber(value: unknown) {
  if (value === null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function mapMovementToReason(type: string, notes: string | null) {
  const normalizedNotes = (notes || '').toLowerCase()

  if (type === 'return_out') return 'return_unsellable'
  if (type === 'manual_adjustment') return 'manual_adjustment'
  if (normalizedNotes.includes('vol') || normalizedNotes.includes('theft')) return 'theft_suspected'
  if (normalizedNotes.includes('cass') || normalizedNotes.includes('damag')) return 'damaged'
  if (type === 'loss') return 'inventory_mismatch'

  return 'manual_adjustment'
}

function mapMovementToStatus(type: string) {
  if (type === 'return_out') return 'investigating'
  return 'open'
}

function isLossEventsSchemaIssue(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021' || error.code === 'P2022') {
      return true
    }

    if (error.code === 'P2010') {
      const meta = error.meta as { code?: string; message?: string } | undefined
      if (
        meta?.code === '42P01' ||
        meta?.code === '42703' ||
        (meta?.message && meta.message.toLowerCase().includes('loss_events'))
      ) {
        return true
      }
    }
  }

  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('loss_events') &&
    (message.includes('does not exist') ||
      message.includes('relation') ||
      message.includes('column') ||
      message.includes('invalid') ||
      message.includes('permission denied'))
  )
}

function serializeLoss(event: DbLossEvent): LossEvent {
  return {
    id: event.id,
    occurredAt: event.occurred_at.toISOString(),
    detectedAt: event.detected_at.toISOString(),
    sourceTable: event.source_table || '',
    sourceLine: event.source_line,
    sourceOrderRef: event.source_order_ref || '',
    productCatalogId: event.product_catalog_id || '',
    sku: event.sku,
    productName: event.product_name,
    category: event.category || '',
    quantityLost: event.quantity_lost,
    orderedQuantity: event.ordered_quantity,
    unitCost: toNumber(event.unit_cost),
    orderUnitPrice: toNumber(event.order_unit_price),
    estimatedLossValue: toNumber(event.estimated_loss_value) || 0,
    detectedStage: event.detected_stage,
    locationLabel: event.location_label || '',
    reasonCategory: event.reason_category,
    reasonDetail: event.reason_detail || '',
    confidence: event.confidence,
    status: event.status,
    carrierName: event.carrier_name || '',
    marketplace: event.marketplace || '',
    supplierName: event.supplier_name || '',
    notes: event.notes || '',
    createdAt: event.created_at.toISOString(),
    updatedAt: event.updated_at.toISOString(),
  }
}

async function loadFromLossEvents(userId: string): Promise<LossEvent[]> {
  const events = await prisma.$queryRaw<DbLossEvent[]>`
    SELECT
      id::text,
      occurred_at,
      detected_at,
      source_table,
      source_line,
      source_order_ref,
      product_catalog_id,
      sku,
      product_name,
      category,
      quantity_lost,
      ordered_quantity,
      unit_cost::numeric(12, 2)::text AS unit_cost,
      order_unit_price::numeric(12, 2)::text AS order_unit_price,
      estimated_loss_value::numeric(12, 2)::text AS estimated_loss_value,
      detected_stage,
      location_label,
      reason_category,
      reason_detail,
      confidence,
      status,
      carrier_name,
      marketplace,
      supplier_name,
      notes,
      created_at,
      updated_at
    FROM public.loss_events
    WHERE user_id = ${userId}::uuid
    ORDER BY detected_at DESC, estimated_loss_value DESC NULLS LAST
  `

  return events.map(serializeLoss)
}

async function loadFromStockMovements(userId: string): Promise<LossEvent[]> {
  const movements = await prisma.stockMovement.findMany({
    where: {
      user_id: userId,
      type: { in: ['loss', 'return_out', 'manual_adjustment'] },
    },
    include: {
      products: {
        select: {
          id: true,
          sku: true,
          name: true,
          location: true,
          supplier: true,
          purchase_price: true,
          supplier_unit_cost_eur: true,
          product_categories: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { created_at: 'desc' },
    take: 250,
  })

  return movements.map((movement) => {
    const quantityLost = Math.abs(movement.quantity)
    const fallbackUnitCost =
      toNumber(movement.unit_price) ??
      toNumber(movement.products.supplier_unit_cost_eur) ??
      toNumber(movement.products.purchase_price) ??
      0
    const estimatedLossValue = fallbackUnitCost * quantityLost
    const occurredAtIso = movement.created_at.toISOString()

    return {
      id: movement.id,
      occurredAt: occurredAtIso,
      detectedAt: occurredAtIso,
      sourceTable: 'stock_movements',
      sourceLine: null,
      sourceOrderRef: movement.reference || '',
      productCatalogId: movement.products.id,
      sku: movement.products.sku || `SKU-${movement.products.id.slice(0, 6).toUpperCase()}`,
      productName: movement.products.name,
      category: movement.products.product_categories?.name || 'Uncategorized',
      quantityLost,
      orderedQuantity: null,
      unitCost: fallbackUnitCost,
      orderUnitPrice: null,
      estimatedLossValue,
      detectedStage: 'warehouse',
      locationLabel: movement.products.location || 'Warehouse',
      reasonCategory: mapMovementToReason(movement.type, movement.notes),
      reasonDetail: movement.notes || `Derived from stock movement (${movement.type})`,
      confidence: 'medium',
      status: mapMovementToStatus(movement.type),
      carrierName: 'Unknown',
      marketplace: 'Other',
      supplierName: movement.products.supplier || '',
      notes: movement.notes || '',
      createdAt: occurredAtIso,
      updatedAt: occurredAtIso,
    }
  })
}

async function loadLossEventsWithFallback(userId: string): Promise<LossEvent[]> {
  try {
    return await loadFromLossEvents(userId)
  } catch (error) {
    if (isLossEventsSchemaIssue(error)) {
      console.warn(
        'loss_events unavailable or schema mismatch. Falling back to stock_movements for losses page.',
        error
      )
      return loadFromStockMovements(userId)
    }
    throw error
  }
}

export default async function LossesPage() {
  try {
    const userId = await getCurrentUserId()
    const events = await loadLossEventsWithFallback(userId)
    return <LossesPageClient initialEvents={events} />
  } catch (error) {
    console.error('Error loading loss events:', error)
    return <LossesPageClient initialEvents={[]} loadError="Impossible de charger les pertes depuis Supabase." />
  }
}
