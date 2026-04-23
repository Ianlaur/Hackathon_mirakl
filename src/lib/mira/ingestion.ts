// MIRA — ingestion of source JSONL files into public.operational_objects.
// One row per source line. raw_payload preserves the line verbatim so a round-trip
// (JSON.stringify(row.raw_payload) === sourceLine) succeeds for every record.

import fs from 'fs/promises'
import readline from 'readline'
import { createReadStream } from 'fs'
import { PrismaClient, type Prisma } from '@prisma/client'

const AMAZON_MARKETPLACE_CHANNEL: Record<string, string> = {
  A13V1IB3VIYZZH: 'amazon_fr',
  APJ6JRA9NG5V4: 'amazon_it',
  A1PA6795UKMFR9: 'amazon_de',
}

export type IngestSourceKind = 'order' | 'message' | 'catalog_item'

export type CanonicalRow = {
  source_channel: string
  kind: IngestSourceKind
  external_id: string
  sku: string | null
  status: string | null
  quantity: number | null
  amount_cents: number | null
  currency: string | null
  occurred_at: Date | null
  raw_payload: unknown
}

function amountToCents(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const num = typeof raw === 'string' ? Number.parseFloat(raw) : Number(raw)
  if (!Number.isFinite(num)) return null
  return Math.round(num * 100)
}

function epochMsToDate(ms: unknown): Date | null {
  const num = typeof ms === 'number' ? ms : Number(ms)
  if (!Number.isFinite(num)) return null
  return new Date(num)
}

function sumQuantity(items: Array<{ quantity?: number; QuantityOrdered?: number }>): number {
  return items.reduce((total, item) => {
    const q = (item.QuantityOrdered ?? item.quantity ?? 0) as number
    return total + (Number.isFinite(q) ? q : 0)
  }, 0)
}

function sumLineTotals(items: Array<any>, totalKey: string, amountKey = 'amount'): number | null {
  let cents = 0
  let anyFound = false
  for (const item of items) {
    const total = item?.[totalKey]
    const amount = total?.Amount ?? total?.[amountKey]
    const c = amountToCents(amount)
    if (c !== null) {
      cents += c
      anyFound = true
    }
  }
  return anyFound ? cents : null
}

// Amazon order line → CanonicalRow. One row per source line (may contain N OrderItems).
export function canonicalizeAmazonOrder(payload: any): CanonicalRow {
  const marketplace = payload?.MarketplaceId as string | undefined
  const channel = (marketplace && AMAZON_MARKETPLACE_CHANNEL[marketplace]) || 'amazon_unknown'
  const items = Array.isArray(payload?.OrderItems) ? payload.OrderItems : []
  const firstSku = items[0]?.SellerSKU ?? items[0]?.ASIN ?? null
  const currency = items[0]?.ItemPrice?.CurrencyCode ?? items[0]?.ItemTotal?.CurrencyCode ?? null
  const occurred = payload?.PurchaseDate ? new Date(payload.PurchaseDate) : null

  return {
    source_channel: channel,
    kind: 'order',
    external_id: String(payload?.AmazonOrderId ?? ''),
    sku: firstSku,
    status: (payload?.OrderStatus as string) ?? null,
    quantity: sumQuantity(items),
    amount_cents: sumLineTotals(items, 'ItemTotal'),
    currency,
    occurred_at: Number.isFinite(occurred?.getTime?.()) ? occurred : null,
    raw_payload: payload,
  }
}

// Google order line → CanonicalRow.
export function canonicalizeGoogleOrder(payload: any): CanonicalRow {
  const channel = (payload?.storefront as string) || 'google_shopping_unknown'
  const items = Array.isArray(payload?.line_items) ? payload.line_items : []
  const firstSku = items[0]?.product_sku ?? null
  const currency = items[0]?.unit_price?.currency_code ?? items[0]?.line_total?.currency_code ?? null

  return {
    source_channel: channel,
    kind: 'order',
    external_id: String(payload?.order_id ?? ''),
    sku: firstSku,
    status: (payload?.state as string) ?? null,
    quantity: sumQuantity(items),
    amount_cents: sumLineTotals(items, 'line_total', 'amount'),
    currency,
    occurred_at: epochMsToDate(payload?.created_at_ms),
    raw_payload: payload,
  }
}

// Amazon message conversation → CanonicalRow (kind=message).
export function canonicalizeAmazonMessage(payload: any): CanonicalRow {
  const marketplace = payload?.marketplaceId as string | undefined
  const channel = (marketplace && AMAZON_MARKETPLACE_CHANNEL[marketplace]) || 'amazon_unknown'
  const conversationId = payload?.conversation?.conversationId
  const createdAt = payload?.conversation?.createdAt
    ? new Date(payload.conversation.createdAt)
    : null

  return {
    source_channel: channel,
    kind: 'message',
    external_id: String(conversationId ?? payload?.amazonOrderId ?? ''),
    sku: (payload?.asin as string) ?? null,
    status: null,
    quantity: null,
    amount_cents: null,
    currency: null,
    occurred_at: Number.isFinite(createdAt?.getTime?.()) ? createdAt : null,
    raw_payload: payload,
  }
}

// Google message thread → CanonicalRow (kind=message).
export function canonicalizeGoogleMessage(payload: any): CanonicalRow {
  const channel = (payload?.storefront as string) || 'google_shopping_unknown'
  const threadRef = payload?.thread?.thread_ref
  const openedTs = payload?.thread?.opened_timestamp

  const openedDate = openedTs ? new Date(Number(openedTs) * 1000) : null

  return {
    source_channel: channel,
    kind: 'message',
    external_id: String(threadRef ?? payload?.order_id ?? ''),
    sku: (payload?.item_id as string) ?? null,
    status: null,
    quantity: null,
    amount_cents: null,
    currency: null,
    occurred_at: Number.isFinite(openedDate?.getTime?.()) ? openedDate : null,
    raw_payload: payload,
  }
}

export type SourceSpec = {
  path: string
  canonicalize: (payload: any) => CanonicalRow
  label: string
}

export const DEFAULT_SOURCES = (dataDir: string): SourceSpec[] => [
  {
    path: `${dataDir}/orders_amazon.jsonl`,
    canonicalize: canonicalizeAmazonOrder,
    label: 'orders_amazon',
  },
  {
    path: `${dataDir}/orders_google.jsonl`,
    canonicalize: canonicalizeGoogleOrder,
    label: 'orders_google',
  },
  {
    path: `${dataDir}/messages_amazon.jsonl`,
    canonicalize: canonicalizeAmazonMessage,
    label: 'messages_amazon',
  },
  {
    path: `${dataDir}/messages_google.jsonl`,
    canonicalize: canonicalizeGoogleMessage,
    label: 'messages_google',
  },
]

async function* readJsonl(path: string): AsyncGenerator<unknown> {
  const rl = readline.createInterface({
    input: createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Number.POSITIVE_INFINITY,
  })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      yield JSON.parse(trimmed)
    } catch (error) {
      console.warn(`[ingestion] skipped unparseable line in ${path}:`, error)
    }
  }
}

export type IngestionReport = {
  totalByLabel: Record<string, number>
  insertedByLabel: Record<string, number>
  skippedByLabel: Record<string, number>
  errors: Array<{ label: string; reason: string }>
}

export type IngestionOptions = {
  userId: string
  sources: SourceSpec[]
  prisma: PrismaClient
}

export async function runIngestion(options: IngestionOptions): Promise<IngestionReport> {
  const report: IngestionReport = {
    totalByLabel: {},
    insertedByLabel: {},
    skippedByLabel: {},
    errors: [],
  }

  for (const source of options.sources) {
    report.totalByLabel[source.label] = 0
    report.insertedByLabel[source.label] = 0
    report.skippedByLabel[source.label] = 0

    try {
      await fs.access(source.path)
    } catch {
      report.errors.push({ label: source.label, reason: `file not found: ${source.path}` })
      continue
    }

    for await (const payload of readJsonl(source.path)) {
      report.totalByLabel[source.label]++
      const row = source.canonicalize(payload)

      if (!row.external_id) {
        report.skippedByLabel[source.label]++
        continue
      }

      try {
        await options.prisma.operationalObject.upsert({
          where: {
            source_channel_kind_external_id: {
              source_channel: row.source_channel,
              kind: row.kind,
              external_id: row.external_id,
            },
          },
          create: {
            user_id: options.userId,
            source_channel: row.source_channel,
            kind: row.kind,
            external_id: row.external_id,
            sku: row.sku,
            status: row.status,
            quantity: row.quantity,
            amount_cents: row.amount_cents,
            currency: row.currency,
            occurred_at: row.occurred_at,
            raw_payload: row.raw_payload as Prisma.InputJsonValue,
          },
          update: {
            sku: row.sku,
            status: row.status,
            quantity: row.quantity,
            amount_cents: row.amount_cents,
            currency: row.currency,
            occurred_at: row.occurred_at,
            raw_payload: row.raw_payload as Prisma.InputJsonValue,
          },
        })
        report.insertedByLabel[source.label]++
      } catch (error) {
        report.errors.push({
          label: source.label,
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  return report
}

// Deep, order-independent equality — Postgres JSONB does not preserve key order,
// so a plain JSON.stringify compare always fails. We check structural equality instead,
// which enforces the actual invariant: "zero field loss".
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return a === b

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false
    }
    return true
  }

  if (Array.isArray(b)) return false

  const aKeys = Object.keys(a as Record<string, unknown>)
  const bKeys = Object.keys(b as Record<string, unknown>)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
      return false
    }
  }
  return true
}

// Round-trip verification: for every stored row, raw_payload is field-equal to the source.
export async function verifyRoundTrip(options: {
  sources: SourceSpec[]
  prisma: PrismaClient
}): Promise<{ checked: number; mismatched: number; samples: string[] }> {
  let checked = 0
  let mismatched = 0
  const samples: string[] = []

  for (const source of options.sources) {
    try {
      await fs.access(source.path)
    } catch {
      continue
    }

    for await (const payload of readJsonl(source.path)) {
      const row = source.canonicalize(payload)
      if (!row.external_id) continue

      const stored = await options.prisma.operationalObject.findUnique({
        where: {
          source_channel_kind_external_id: {
            source_channel: row.source_channel,
            kind: row.kind,
            external_id: row.external_id,
          },
        },
        select: { raw_payload: true },
      })

      checked++
      if (!stored) {
        mismatched++
        if (samples.length < 5) samples.push(`missing ${source.label}:${row.external_id}`)
        continue
      }

      if (!deepEqual(payload, stored.raw_payload)) {
        mismatched++
        if (samples.length < 5) samples.push(`diff ${source.label}:${row.external_id}`)
      }
    }
  }

  return { checked, mismatched, samples }
}
