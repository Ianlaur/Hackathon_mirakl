import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { syncShopifyOrdersForConnection } from '@/lib/shopify-sync'

export const dynamic = 'force-dynamic'

const syncSchema = z.object({
  limit: z.number().int().min(1).max(250).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json().catch(() => ({}))
    const payload = syncSchema.parse(body)

    const connections = await prisma.shopifyConnection.findMany({
      where: {
        user_id: userId,
        status: { in: ['active', 'connected'] },
      },
      orderBy: { updated_at: 'desc' },
    })

    if (!connections.length) {
      return NextResponse.json(
        { error: 'No active Shopify connection found' },
        { status: 404 }
      )
    }

    const results = []
    for (const connection of connections) {
      const summary = await syncShopifyOrdersForConnection({
        connectionId: connection.id,
        limit: payload.limit ?? 50,
      })
      results.push(summary)
    }

    return NextResponse.json({
      syncedConnections: results.length,
      results,
    })
  } catch (error) {
    console.error('Error syncing Shopify data:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid sync payload' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync Shopify data' },
      { status: 500 }
    )
  }
}
