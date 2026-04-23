import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await getCurrentUserId()

    const connections = await prisma.shopifyConnection.findMany({
      where: { user_id: userId },
      include: {
        _count: { select: { orders: true } },
      },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json({
      connected: connections.some((connection) => connection.status === 'active'),
      connections: connections.map((connection) => ({
        id: connection.id,
        shopDomain: connection.shop_domain,
        shopName: connection.shop_name,
        status: connection.status,
        scopes: connection.scopes,
        installedAt: connection.installed_at,
        lastSyncedAt: connection.last_synced_at,
        lastWebhookAt: connection.last_webhook_at,
        ordersCount: connection._count.orders,
      })),
    })
  } catch (error) {
    console.error('Error loading Shopify status:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Shopify status' },
      { status: 500 }
    )
  }
}
