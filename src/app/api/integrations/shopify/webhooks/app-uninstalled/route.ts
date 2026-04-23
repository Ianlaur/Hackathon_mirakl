import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShopifyConfig, normalizeShopDomain, verifyShopifyWebhookHmac } from '@/lib/shopify'

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
      return NextResponse.json({ ok: true, ignored: true })
    }

    await prisma.shopifyConnection.update({
      where: { id: connection.id },
      data: {
        status: 'uninstalled',
        encrypted_access_token: '',
        uninstalled_at: new Date(),
        last_webhook_at: new Date(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error handling Shopify app/uninstalled webhook:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook handling failed' },
      { status: 500 }
    )
  }
}
