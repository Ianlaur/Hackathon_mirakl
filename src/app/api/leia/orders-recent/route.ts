import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  buildMarketplacePresentation,
  deriveRecentOrderRowStatus,
  deriveRecentOrderWindowBucket,
  matchesMarketplaceFilter,
} from '@/lib/recent-orders'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

type OrderRowDTO = {
  id: string
  channel: string
  marketplace_label: string
  marketplace_code: string
  amount_eur: number
  status: 'fulfilled' | 'processing' | 'risk_attached'
  items_count: number
  occurred_at: string
}

type AggregateCounts = {
  pending_action: number
  in_transit: number
  delivered_24h: number
  processing: number
}

function parseChannels(param: string | null): string[] | null {
  if (!param) return null

  const filters = param
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return filters.length > 0 ? filters : null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const url = new URL(request.url)
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '4', 10) || 4, 1), 50)
    const channels = parseChannels(url.searchParams.get('channel'))
    const wantAggregate = url.searchParams.get('aggregate') === 'true'

    const orders = await prisma.shopifyOrder.findMany({
      where: { user_id: userId },
      include: {
        connection: {
          select: {
            shop_name: true,
            shop_domain: true,
          },
        },
      },
      orderBy: [{ order_created_at: 'desc' }, { created_at: 'desc' }],
      take: Math.max(limit, 100),
    })

    const filteredOrders = orders.filter((order) =>
      matchesMarketplaceFilter(channels, order.connection.shop_name, order.connection.shop_domain)
    )

    const rows: OrderRowDTO[] = filteredOrders.slice(0, limit).map((order) => {
      const { label, code } = buildMarketplacePresentation(
        order.connection.shop_name,
        order.connection.shop_domain
      )
      const occurredAt = order.order_created_at ?? order.processed_at ?? order.created_at
      const status = deriveRecentOrderRowStatus(order.financial_status, order.fulfillment_status)

      return {
        id: order.shopify_order_id || order.id,
        channel: label.toLowerCase().replace(/\s+/g, '_'),
        marketplace_label: label,
        marketplace_code: code,
        amount_eur: Number(order.total_price ?? 0),
        status,
        items_count: order.line_items_count || 1,
        occurred_at: occurredAt.toISOString(),
      }
    })

    if (!wantAggregate) {
      return NextResponse.json({ rows })
    }

    const since24h = Date.now() - DAY_MS
    const recent24h = filteredOrders.filter((order) => {
      const occurredAt = order.order_created_at ?? order.processed_at ?? order.created_at
      return occurredAt.getTime() >= since24h
    })

    let inTransit = 0
    let delivered24h = 0
    let processing = 0

    for (const order of recent24h) {
      const bucket = deriveRecentOrderWindowBucket(order.fulfillment_status)

      if (bucket === 'in_transit') inTransit += 1
      else if (bucket === 'delivered_24h') delivered24h += 1
      else processing += 1
    }

    const pendingAction = await prisma.agentRecommendation.count({
      where: {
        user_id: userId,
        status: 'pending_approval',
      },
    })

    const aggregate: AggregateCounts = {
      pending_action: pendingAction,
      in_transit: inTransit,
      delivered_24h: delivered24h,
      processing,
    }

    return NextResponse.json({ rows, aggregate })
  } catch (error) {
    console.error('orders-recent error:', error)
    return NextResponse.json({ rows: [] }, { status: 200 })
  }
}
