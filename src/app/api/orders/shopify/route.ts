import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const limitParam = Number(new URL(request.url).searchParams.get('limit') || '50')
    const limit = Number.isNaN(limitParam) ? 50 : Math.max(1, Math.min(limitParam, 250))

    const orders = await prisma.shopifyOrder.findMany({
      where: { user_id: userId },
      include: {
        connection: {
          select: {
            shop_domain: true,
            shop_name: true,
          },
        },
      },
      orderBy: { order_created_at: 'desc' },
      take: limit,
    })

    const totalRevenue = orders.reduce((sum, order) => {
      if (!order.total_price) return sum
      return sum + Number(order.total_price)
    }, 0)

    const pendingCount = orders.filter(
      (order) => order.financial_status === 'pending' || order.fulfillment_status === null
    ).length

    return NextResponse.json({
      summary: {
        count: orders.length,
        totalRevenue,
        pendingCount,
      },
      orders: orders.map((order) => ({
        id: order.id,
        shopifyOrderId: order.shopify_order_id,
        name: order.order_name,
        email: order.email,
        currency: order.currency,
        financialStatus: order.financial_status,
        fulfillmentStatus: order.fulfillment_status,
        totalPrice: order.total_price,
        createdAt: order.order_created_at,
        source: order.connection.shop_name || order.connection.shop_domain,
      })),
    })
  } catch (error) {
    console.error('Error loading Shopify orders:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Shopify orders' },
      { status: 500 }
    )
  }
}
