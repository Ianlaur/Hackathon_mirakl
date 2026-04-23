import { Prisma } from '@prisma/client'
import { decryptSecret, encryptSecret } from '@/lib/crypto'
import { prisma } from '@/lib/prisma'
import { serializeJson } from '@/lib/serialize'
import { fetchShopifyOrders, getShopifyConfig, type ShopifyRestOrder } from '@/lib/shopify'

type UpsertOrderArgs = {
  connectionId: string
  userId: string
  payload: ShopifyRestOrder
}

type SyncConnectionArgs = {
  connectionId: string
  limit?: number
}

export type ShopifySyncSummary = {
  connectionId: string
  shopDomain: string
  fetched: number
  upserted: number
}

function parseDate(value: unknown) {
  if (!value || typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function parseDecimal(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numeric = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(numeric)) {
    return null
  }

  return numeric.toFixed(2)
}

function toOrderData(args: UpsertOrderArgs) {
  const payload = args.payload
  const shopifyOrderId = String(payload.id)
  const lineItems =
    payload.line_items && Array.isArray(payload.line_items) ? payload.line_items : []

  return {
    user_id: args.userId,
    connection_id: args.connectionId,
    shopify_order_id: shopifyOrderId,
    order_name:
      typeof payload.name === 'string' ? payload.name : null,
    email:
      typeof payload.email === 'string' ? payload.email : null,
    currency:
      typeof payload.currency === 'string' ? payload.currency : null,
    financial_status:
      typeof payload.financial_status === 'string' ? payload.financial_status : null,
    fulfillment_status:
      typeof payload.fulfillment_status === 'string' ? payload.fulfillment_status : null,
    order_status_url:
      typeof payload.order_status_url === 'string' ? payload.order_status_url : null,
    line_items_count: lineItems.length,
    total_price: parseDecimal(payload.total_price),
    subtotal_price: parseDecimal(payload.subtotal_price),
    total_tax: parseDecimal(payload.total_tax),
    total_discounts: parseDecimal(payload.total_discounts),
    processed_at: parseDate(payload.processed_at),
    order_created_at: parseDate(payload.created_at),
    raw_payload: serializeJson(payload) as Prisma.InputJsonValue,
  }
}

export async function upsertShopifyOrder(args: UpsertOrderArgs) {
  const data = toOrderData(args)
  return prisma.shopifyOrder.upsert({
    where: {
      connection_id_shopify_order_id: {
        connection_id: args.connectionId,
        shopify_order_id: String(args.payload.id),
      },
    },
    update: data,
    create: data,
  })
}

export async function syncShopifyOrdersForConnection(args: SyncConnectionArgs): Promise<ShopifySyncSummary> {
  const { apiVersion } = getShopifyConfig()
  const connection = await prisma.shopifyConnection.findUnique({
    where: { id: args.connectionId },
  })

  if (!connection) {
    throw new Error('Shopify connection not found')
  }

  if (!connection.encrypted_access_token) {
    throw new Error('Missing Shopify access token')
  }

  const accessToken = decryptSecret(connection.encrypted_access_token)
  const orders = await fetchShopifyOrders({
    shop: connection.shop_domain,
    accessToken,
    apiVersion,
    limit: args.limit ?? 50,
  })

  let upserted = 0
  for (const order of orders) {
    await upsertShopifyOrder({
      connectionId: connection.id,
      userId: connection.user_id,
      payload: order,
    })
    upserted += 1
  }

  await prisma.shopifyConnection.update({
    where: { id: connection.id },
    data: {
      status: 'active',
      last_synced_at: new Date(),
    },
  })

  return {
    connectionId: connection.id,
    shopDomain: connection.shop_domain,
    fetched: orders.length,
    upserted,
  }
}

export async function storeShopifyConnection(args: {
  userId: string
  shopDomain: string
  shopName?: string | null
  externalShopId?: string | null
  accessToken: string
  scopes: string[]
}) {
  const existing = await prisma.shopifyConnection.findUnique({
    where: { shop_domain: args.shopDomain },
  })

  if (existing && existing.user_id !== args.userId) {
    throw new Error(`Shop ${args.shopDomain} is already connected to another account`)
  }

  const encryptedToken = encryptSecret(args.accessToken)

  return prisma.shopifyConnection.upsert({
    where: { shop_domain: args.shopDomain },
    update: {
      user_id: args.userId,
      shop_name: args.shopName || existing?.shop_name || null,
      external_shop_id: args.externalShopId || existing?.external_shop_id || null,
      encrypted_access_token: encryptedToken,
      scopes: args.scopes,
      status: 'active',
      installed_at: new Date(),
      uninstalled_at: null,
    },
    create: {
      user_id: args.userId,
      shop_domain: args.shopDomain,
      shop_name: args.shopName || null,
      external_shop_id: args.externalShopId || null,
      encrypted_access_token: encryptedToken,
      scopes: args.scopes,
      status: 'active',
      installed_at: new Date(),
    },
  })
}
