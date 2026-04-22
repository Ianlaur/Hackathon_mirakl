import { prisma } from '@/lib/prisma'
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

function toNumber(value: string | number | null) {
  if (value === null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
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

export default async function LossesPage() {
  try {
    const userId = await getCurrentUserId()
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

    return <LossesPageClient initialEvents={events.map(serializeLoss)} />
  } catch (error) {
    console.error('Error loading loss events:', error)
    return <LossesPageClient initialEvents={[]} loadError="Impossible de charger les pertes depuis Supabase." />
  }
}
