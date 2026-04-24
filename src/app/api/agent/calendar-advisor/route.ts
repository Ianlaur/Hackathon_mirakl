import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { buildPlanItems, summarizePlan } from '@/lib/calendar-restock'
import { enrichWithFallback } from '@/lib/calendar-restock-llm'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  event_id: z.string().uuid(),
  user_id: z.string().uuid(),
})

type LeaveEventRow = {
  id: string
  user_id: string
  title: string
  start_at: Date
  end_at: Date
  kind: string
}

type OrderCountRow = { sku: string; cnt: number }

type CoincidingEventRow = {
  title: string
  kind: string
  impact: string
  start_at: Date
  end_at: Date
}

const DAY_MS = 24 * 60 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const { event_id, user_id } = parsed.data

    const events = await prisma.$queryRaw<LeaveEventRow[]>`
      SELECT id, user_id, title, start_at, end_at, kind
      FROM public.calendar_events
      WHERE id = ${event_id}::uuid AND user_id = ${user_id}::uuid AND kind = 'leave'
      LIMIT 1
    `
    if (events.length === 0) {
      return NextResponse.json({ error: 'Leave event not found' }, { status: 404 })
    }
    const event = events[0]

    const products = await prisma.product.findMany({
      where: { user_id, active: true },
      select: {
        id: true,
        sku: true,
        name: true,
        quantity: true,
        supplier: true,
        supplier_lead_time_days: true,
        supplier_unit_cost_eur: true,
      },
    })

    const orderCounts = await prisma.$queryRaw<OrderCountRow[]>`
      SELECT sku, SUM(qty)::int AS cnt
      FROM (
        SELECT (item->>'SellerSKU') AS sku, COALESCE((item->>'QuantityOrdered')::int, 1) AS qty
        FROM public.data_orders_amazon o,
             jsonb_array_elements(o.order_items) AS item
        WHERE o.purchase_date >= NOW() - INTERVAL '60 days'
        UNION ALL
        SELECT (item->>'product_sku') AS sku, COALESCE((item->>'quantity')::int, 1) AS qty
        FROM public.data_orders_google o,
             jsonb_array_elements(o.line_items) AS item
        WHERE o.created_at >= NOW() - INTERVAL '60 days'
      ) x
      WHERE sku IS NOT NULL
      GROUP BY sku
    `
    const ordersMap = new Map(orderCounts.map((r) => [r.sku, r.cnt]))

    const attentionStart = new Date(event.start_at.getTime() - 14 * DAY_MS)
    const attentionEnd = new Date(event.end_at.getTime() + 14 * DAY_MS)

    const coincidingEventsRaw = await prisma.$queryRaw<CoincidingEventRow[]>`
      SELECT title, kind, impact, start_at, end_at
      FROM public.calendar_events
      WHERE user_id = ${user_id}::uuid
        AND kind <> 'leave'
        AND start_at <= ${attentionEnd}
        AND end_at >= ${attentionStart}
        AND (
          kind IN ('commerce', 'peak', 'marketing', 'celebration')
          OR impact IN ('high', 'critical')
          OR title ~* '(sale|sales|soldes|black friday|cyber monday|christmas|noel|peak|promo)'
        )
    `
    const commercialEvents = coincidingEventsRaw.map((e) => ({
      title: e.title,
      kind: e.kind,
      impact: e.impact,
      start: e.start_at,
      end: e.end_at,
    }))

    const today = new Date()
    const items = buildPlanItems({
      today,
      leaveStart: event.start_at,
      leaveEnd: event.end_at,
      products: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        currentStock: p.quantity,
        supplier: p.supplier,
        supplierLeadTimeDays: p.supplier_lead_time_days ?? 7,
        supplierUnitCostEur: Number(p.supplier_unit_cost_eur ?? 0),
      })),
      orders: products.map((p) => ({
        productId: p.id,
        orders60d: p.sku ? (ordersMap.get(p.sku) ?? 0) : 0,
      })),
      commercialEvents,
    })

    const summary = summarizePlan(items)

    const aiSettings = await prisma.merchantAiSettings.findUnique({ where: { user_id } })
    const merchantProfile = await prisma.merchantProfileContext.findUnique({
      where: { user_id },
    })

    const enrichment = await enrichWithFallback(
      {
        leaveTitle: event.title,
        leaveStart: event.start_at,
        leaveEnd: event.end_at,
        atRiskItems: items,
        coincidingEvents: commercialEvents.map((e) => ({
          title: e.title,
          kind: e.kind,
          start: e.start,
          end: e.end,
        })),
        merchantProfile: merchantProfile
          ? {
              merchantCategory: merchantProfile.merchant_category,
              operatingRegions: merchantProfile.operating_regions,
              supplierRegions: merchantProfile.supplier_regions,
              seasonalityTags: merchantProfile.seasonality_tags,
            }
          : null,
      },
      aiSettings?.encrypted_api_key,
      aiSettings?.preferred_model ?? 'gpt-5.4-mini'
    )

    const startIso = event.start_at.toISOString().slice(0, 10)
    const endIso = event.end_at.toISOString().slice(0, 10)
    const title = `Vacation plan ${startIso} -> ${endIso}`

    const evidence = [
      { label: "Absence period", value: `${startIso} -> ${endIso}` },
      { label: 'SKUs analyzed', value: String(products.length) },
      { label: 'SKUs at risk', value: String(items.length) },
      {
        label: 'Order deadline',
        value: summary.earliestDeadline?.toISOString().slice(0, 10) ?? '-',
      },
      { label: 'Estimated total cost', value: `€${summary.totalCostEur.toFixed(2)}` },
      {
        label: 'Commercial pressure events',
        value:
          commercialEvents.length > 0
            ? commercialEvents.map((e) => e.title).join(', ')
            : 'None',
      },
    ]

    const actionPayload = {
      leave_event_id: event.id,
      leave_start: startIso,
      leave_end: endIso,
      leave_duration_days: Math.round(
        (event.end_at.getTime() - event.start_at.getTime()) / (24 * 3600 * 1000)
      ),
      order_deadline: summary.earliestDeadline?.toISOString().slice(0, 10) ?? null,
      total_estimated_cost_eur: summary.totalCostEur,
      items_count: items.length,
      target: 'calendar_restock_plan',
      supplementary_notes: enrichment.supplementaryNotes,
      commercial_events: commercialEvents.map((e) => ({
        title: e.title,
        kind: e.kind,
        impact: e.impact,
        start: e.start.toISOString().slice(0, 10),
        end: e.end.toISOString().slice(0, 10),
      })),
      supply_strategies: enrichment.supplementaryNotes,
      items: items.map((i) => ({
        product_id: i.productId,
        sku: i.sku,
        product_name: i.productName,
        current_stock: i.currentStock,
        velocity_per_day: i.velocityPerDay,
        projected_stock_end_of_leave: i.projectedStockEndOfLeave,
        recommended_qty: i.recommendedQty,
        supplier: i.supplier,
        lead_time_days: i.leadTimeDays,
        unit_cost_eur: i.unitCostEur,
        estimated_cost_eur: i.estimatedCostEur,
        priority: i.priority,
        order_deadline: i.orderDeadline.toISOString().slice(0, 10),
        reasoning: i.reasoning,
        commercial_pressure_multiplier: i.commercialPressureMultiplier ?? 1,
        supply_strategies: i.supplyStrategies ?? [],
      })),
    }

    const existing = await prisma.agentRecommendation.findFirst({
      where: {
        user_id,
        scenario_type: 'calendar_restock_plan',
        status: 'pending_approval',
        action_payload: { path: ['leave_event_id'], equals: event.id },
      },
    })

    const recommendation = existing
      ? await prisma.agentRecommendation.update({
          where: { id: existing.id },
          data: {
            title,
            reasoning_summary: enrichment.reasoningSummary,
            expected_impact: enrichment.expectedImpact,
            confidence_note: enrichment.confidenceNote,
            evidence_payload: evidence,
            action_payload: actionPayload,
          },
        })
      : await prisma.agentRecommendation.create({
          data: {
            user_id,
            title,
            scenario_type: 'calendar_restock_plan',
            status: 'pending_approval',
            reasoning_summary: enrichment.reasoningSummary,
            expected_impact: enrichment.expectedImpact,
            confidence_note: enrichment.confidenceNote,
            evidence_payload: evidence,
            action_payload: actionPayload,
            approval_required: true,
            source: 'calendar_advisor',
          },
        })

    return NextResponse.json({
      recommendation_id: recommendation.id,
      items_count: items.length,
      total_cost_eur: summary.totalCostEur,
      supply_strategies: enrichment.supplementaryNotes,
      llm_used: !enrichment.fallback,
    })
  } catch (error) {
    console.error('calendar-advisor error:', error)
    return NextResponse.json(
      { error: 'Internal error', detail: String(error) },
      { status: 500 }
    )
  }
}
