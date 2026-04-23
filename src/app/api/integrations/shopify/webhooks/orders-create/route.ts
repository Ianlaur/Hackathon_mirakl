import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizeShopDomain, verifyShopifyWebhookHmac, getShopifyConfig, type ShopifyRestOrder } from '@/lib/shopify'
import { upsertShopifyOrder } from '@/lib/shopify-sync'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const { apiSecret } = getShopifyConfig()
  if (!apiSecret) {
    return NextResponse.json(
      { error: 'SHOPIFY_API_SECRET is missing' },
      { status: 500 }
    )
  }

  try {
    const rawBody = await request.text()
    const hmacHeader = request.headers.get('x-shopify-hmac-sha256')
    const shopHeader = request.headers.get('x-shopify-shop-domain')

    if (!verifyShopifyWebhookHmac(rawBody, hmacHeader, apiSecret)) {
      return NextResponse.json({ error: 'Invalid Shopify webhook signature' }, { status: 401 })
    }

    if (!shopHeader) {
      return NextResponse.json({ error: 'Missing Shopify shop header' }, { status: 400 })
    }

    const shopDomain = normalizeShopDomain(shopHeader)
    const connection = await prisma.shopifyConnection.findUnique({
      where: { shop_domain: shopDomain },
    })

    if (!connection) {
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 })
    }

    const payload = JSON.parse(rawBody) as ShopifyRestOrder
    if (!payload.id) {
      return NextResponse.json({ error: 'Missing order id in webhook payload' }, { status: 400 })
    }

    await upsertShopifyOrder({
      connectionId: connection.id,
      userId: connection.user_id,
      payload,
    })

    await prisma.shopifyConnection.update({
      where: { id: connection.id },
      data: { last_webhook_at: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error handling Shopify orders/create webhook:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook handling failed' },
      { status: 500 }
    )
  }
}
