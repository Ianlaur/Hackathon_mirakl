import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { z } from 'zod'

const DEFAULT_SHOPIFY_SCOPES = ['read_orders', 'read_products', 'read_inventory']
const DEFAULT_SHOPIFY_API_VERSION = '2025-01'

const accessTokenSchema = z.object({
  access_token: z.string().min(1),
  scope: z.string().optional(),
})

const shopSchema = z.object({
  shop: z.object({
    id: z.union([z.number(), z.string()]),
    name: z.string().optional(),
    domain: z.string().optional(),
    myshopify_domain: z.string().optional(),
  }),
})

const ordersSchema = z.object({
  orders: z.array(z.record(z.any())),
})

export type ShopifyRestOrder = {
  id: number | string
  name?: string | null
  email?: string | null
  currency?: string | null
  financial_status?: string | null
  fulfillment_status?: string | null
  order_status_url?: string | null
  total_price?: string | number | null
  subtotal_price?: string | number | null
  total_tax?: string | number | null
  total_discounts?: string | number | null
  created_at?: string | null
  processed_at?: string | null
  line_items?: Array<unknown>
  [key: string]: unknown
}

export function getShopifyConfig() {
  return {
    apiKey: process.env.SHOPIFY_API_KEY?.trim() || '',
    apiSecret: process.env.SHOPIFY_API_SECRET?.trim() || '',
    appUrl: process.env.SHOPIFY_APP_URL?.trim() || '',
    apiVersion: process.env.SHOPIFY_API_VERSION?.trim() || DEFAULT_SHOPIFY_API_VERSION,
    scopes:
      process.env.SHOPIFY_SCOPES?.split(',')
        .map((scope) => scope.trim())
        .filter(Boolean) || DEFAULT_SHOPIFY_SCOPES,
  }
}

export function normalizeShopDomain(input: string) {
  let shop = input.trim().toLowerCase()
  if (!shop) {
    throw new Error('Shop domain is required')
  }

  shop = shop.replace(/^https?:\/\//, '').split('/')[0]
  if (!shop.endsWith('.myshopify.com')) {
    if (/^[a-z0-9][a-z0-9-]*$/.test(shop)) {
      shop = `${shop}.myshopify.com`
    }
  }

  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) {
    throw new Error('Invalid Shopify domain. Use your-store.myshopify.com')
  }

  return shop
}

export function buildShopifyInstallUrl(args: {
  shop: string
  apiKey: string
  scopes: string[]
  redirectUri: string
  state: string
}) {
  const params = new URLSearchParams({
    client_id: args.apiKey,
    scope: args.scopes.join(','),
    redirect_uri: args.redirectUri,
    state: args.state,
  })

  return `https://${args.shop}/admin/oauth/authorize?${params.toString()}`
}

export function generateShopifyState() {
  return randomBytes(16).toString('hex')
}

function safeEqual(expected: string, received: string) {
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(received)

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

export function verifyShopifyOAuthHmac(searchParams: URLSearchParams, secret: string) {
  const providedHmac = searchParams.get('hmac')
  if (!providedHmac) {
    return false
  }

  const message = Array.from(searchParams.entries())
    .filter(([key]) => key !== 'hmac' && key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const digest = createHmac('sha256', secret).update(message).digest('hex')
  return safeEqual(digest, providedHmac)
}

export function verifyShopifyWebhookHmac(rawBody: string, hmacHeader: string | null, secret: string) {
  if (!hmacHeader) {
    return false
  }

  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  return safeEqual(digest, hmacHeader)
}

export async function exchangeShopifyCodeForToken(args: {
  shop: string
  code: string
  apiKey: string
  apiSecret: string
}) {
  const response = await fetch(`https://${args.shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: args.apiKey,
      client_secret: args.apiSecret,
      code: args.code,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Shopify token exchange failed (${response.status}): ${body}`)
  }

  return accessTokenSchema.parse(await response.json())
}

export async function fetchShopifyShop(args: {
  shop: string
  accessToken: string
  apiVersion: string
}) {
  const response = await fetch(`https://${args.shop}/admin/api/${args.apiVersion}/shop.json`, {
    headers: {
      'X-Shopify-Access-Token': args.accessToken,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Shopify shop fetch failed (${response.status}): ${body}`)
  }

  return shopSchema.parse(await response.json()).shop
}

export async function fetchShopifyOrders(args: {
  shop: string
  accessToken: string
  apiVersion: string
  limit?: number
}) {
  const limit = Math.max(1, Math.min(args.limit ?? 50, 250))
  const params = new URLSearchParams({
    status: 'any',
    limit: String(limit),
    order: 'created_at desc',
  })

  const response = await fetch(
    `https://${args.shop}/admin/api/${args.apiVersion}/orders.json?${params.toString()}`,
    {
      headers: {
        'X-Shopify-Access-Token': args.accessToken,
        Accept: 'application/json',
      },
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Shopify orders fetch failed (${response.status}): ${body}`)
  }

  const parsed = ordersSchema.parse(await response.json())
  return parsed.orders as ShopifyRestOrder[]
}

export async function registerShopifyWebhook(args: {
  shop: string
  accessToken: string
  apiVersion: string
  topic: string
  address: string
}) {
  const response = await fetch(`https://${args.shop}/admin/api/${args.apiVersion}/webhooks.json`, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': args.accessToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      webhook: {
        topic: args.topic,
        address: args.address,
        format: 'json',
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Shopify webhook registration failed (${args.topic}): ${body}`)
  }

  return response.json()
}
