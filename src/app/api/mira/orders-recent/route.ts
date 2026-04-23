// MIRA — Recent orders endpoint. Feeds dashboard/orders pages in one round trip.
// Supports comma-separated channel filter and optional aggregate counts.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

type OrderRow = {
  id: string
  external_id: string | null
  channel: string
  sku: string | null
  status: string
  amount_cents: number
  currency: string
  occurred_at: string | null
  has_pending_decision: boolean
}

type AggregateCounts = {
  pending_action: number
  in_transit: number
  delivered_24h: number
  processing: number
}

// Derive a stable display status from raw status + decision flag.
function deriveStatus(raw: string | null, hasPending: boolean): string {
  if (hasPending) return 'action_required'
  const s = (raw ?? '').toLowerCase()
  if (s === 'shipped' || s === 'in_transit') return 'in_transit'
  if (s === 'delivered' || s === 'fulfilled') return 'delivered'
  if (s === 'cancelled' || s === 'canceled' || s === 'refunded') return 'cancelled'
  return 'processing'
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const url = new URL(request.url)
    const channelParam = url.searchParams.get('channel')
    const limitParam = url.searchParams.get('limit')
    const aggregateParam = url.searchParams.get('aggregate') === 'true'
    const limit = Math.min(Math.max(Number.parseInt(limitParam || '20', 10) || 20, 1), 200)

    const channels = channelParam
      ? channelParam.split(',').map((c) => c.trim()).filter(Boolean)
      : null

    const since24h = new Date(Date.now() - DAY_MS)

    const whereBase = {
      user_id: userId,
      kind: 'order',
      ...(channels && channels.length > 0 ? { source_channel: { in: channels } } : {}),
    }

    const [orders, pendingDecisions, aggregateRows] = await Promise.all([
      prisma.operationalObject.findMany({
        where: whereBase,
        orderBy: { occurred_at: 'desc' },
        take: limit,
        select: {
          id: true,
          external_id: true,
          source_channel: true,
          sku: true,
          status: true,
          amount_cents: true,
          currency: true,
          occurred_at: true,
        },
      }),
      prisma.decisionRecord.findMany({
        where: {
          user_id: userId,
          status: { in: ['proposed', 'queued'] },
          ...(channels && channels.length > 0 ? { channel: { in: channels } } : {}),
        },
        select: { trigger_event_id: true, sku: true, channel: true },
      }),
      aggregateParam
        ? prisma.operationalObject.findMany({
            where: {
              ...whereBase,
              occurred_at: { gte: since24h },
            },
            select: { status: true, external_id: true, sku: true, source_channel: true },
          })
        : Promise.resolve([]),
    ])

    const pendingKeys = new Set<string>()
    for (const d of pendingDecisions) {
      if (d.trigger_event_id) pendingKeys.add(d.trigger_event_id)
    }

    const rows: OrderRow[] = orders.map((o) => {
      const hasPending = !!(o.external_id && pendingKeys.has(o.external_id))
      return {
        id: o.id,
        external_id: o.external_id,
        channel: o.source_channel,
        sku: o.sku,
        status: deriveStatus(o.status, hasPending),
        amount_cents: o.amount_cents ?? 0,
        currency: o.currency ?? 'EUR',
        occurred_at: o.occurred_at?.toISOString() ?? null,
        has_pending_decision: hasPending,
      }
    })

    let aggregate: AggregateCounts | undefined
    if (aggregateParam) {
      let pending_action = 0
      let in_transit = 0
      let delivered_24h = 0
      let processing = 0
      for (const o of aggregateRows) {
        const hasPending = !!(o.external_id && pendingKeys.has(o.external_id))
        const derived = deriveStatus(o.status, hasPending)
        if (derived === 'action_required') pending_action += 1
        else if (derived === 'in_transit') in_transit += 1
        else if (derived === 'delivered') delivered_24h += 1
        else if (derived === 'processing') processing += 1
      }
      aggregate = { pending_action, in_transit, delivered_24h, processing }
    }

    return NextResponse.json({
      count: rows.length,
      orders: rows,
      ...(aggregate ? { aggregate } : {}),
    })
  } catch (error) {
    console.error('orders-recent fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load recent orders' },
      { status: 500 },
    )
  }
}
