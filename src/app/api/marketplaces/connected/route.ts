// GET /api/marketplaces/connected
// Aggregates distinct source_channel from operational_objects into "connected marketplaces"
// plus Shopify connections. Revenue = sum of order amount_cents over last 30 days.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

// Prefer human-friendly names + fun icons for the few channels we know about.
const CHANNEL_DISPLAY: Record<string, { label: string; icon: string }> = {
  amazon_fr: { label: 'Amazon FR', icon: '🛒' },
  amazon_it: { label: 'Amazon IT', icon: '🛒' },
  amazon_de: { label: 'Amazon DE', icon: '🛒' },
  google_shopping_fr: { label: 'Google Shopping FR', icon: '🔎' },
  google_shopping_it: { label: 'Google Shopping IT', icon: '🔎' },
  google_shopping_de: { label: 'Google Shopping DE', icon: '🔎' },
}

function displayFor(channel: string) {
  return CHANNEL_DISPLAY[channel] ?? { label: channel, icon: '🏪' }
}

export async function GET(_request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const since = new Date(Date.now() - THIRTY_DAYS_MS)

    const [currentWindow, previousWindow, shopifyConnections] = await Promise.all([
      prisma.operationalObject.groupBy({
        by: ['source_channel'],
        where: {
          user_id: userId,
          kind: 'order',
          occurred_at: { gte: since },
        },
        _count: { _all: true },
        _sum: { amount_cents: true },
      }),
      prisma.operationalObject.groupBy({
        by: ['source_channel'],
        where: {
          user_id: userId,
          kind: 'order',
          occurred_at: {
            gte: new Date(Date.now() - 2 * THIRTY_DAYS_MS),
            lt: since,
          },
        },
        _sum: { amount_cents: true },
      }),
      prisma.shopifyConnection.findMany({
        where: { user_id: userId, status: 'active' },
        select: { id: true, shop_name: true, shop_domain: true, last_synced_at: true },
      }),
    ])

    const previousRevenue = new Map<string, number>()
    for (const row of previousWindow) {
      previousRevenue.set(row.source_channel, row._sum.amount_cents ?? 0)
    }

    const connectors = currentWindow.map((row) => {
      const revenueCents = row._sum.amount_cents ?? 0
      const previous = previousRevenue.get(row.source_channel) ?? 0
      const delta = previous > 0 ? ((revenueCents - previous) / previous) * 100 : 0
      const meta = displayFor(row.source_channel)
      const stable = delta >= -10 // arbitrary threshold — below -10% triggers REVIEW
      return {
        channel: row.source_channel,
        name: meta.label,
        icon: meta.icon,
        orders_30d: row._count._all,
        revenue_30d_cents: revenueCents,
        previous_revenue_cents: previous,
        delta_pct: Number(delta.toFixed(1)),
        status: stable ? 'STABLE' : 'REVIEW',
      }
    })

    // Include Shopify connections as channels even if no orders yet.
    for (const c of shopifyConnections) {
      const channel = `shopify:${c.shop_domain}`
      if (connectors.some((x) => x.channel === channel)) continue
      connectors.push({
        channel,
        name: c.shop_name ?? c.shop_domain,
        icon: '🛍️',
        orders_30d: 0,
        revenue_30d_cents: 0,
        previous_revenue_cents: 0,
        delta_pct: 0,
        status: 'STABLE',
      })
    }

    return NextResponse.json({ count: connectors.length, connectors })
  } catch (error) {
    console.error('marketplaces connected fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load connected marketplaces' },
      { status: 500 },
    )
  }
}
