// Leia — recent orders aggregator backing Dashboard + Orders tables.
// Derives a synthetic per-row status from operational_objects + decision_ledger cross-check,
// and optionally returns 24h status bucket counts via ?aggregate=true.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

const MARKETPLACE_LABEL: Record<string, { label: string; code: string }> = {
  amazon_fr: { label: 'Amazon FR', code: 'AMZ' },
  amazon_it: { label: 'Amazon IT', code: 'AMZ' },
  amazon_de: { label: 'Amazon DE', code: 'AMZ' },
  google_shopping_fr: { label: 'Google Shopping FR', code: 'GGL' },
  google_shopping_it: { label: 'Google Shopping IT', code: 'GGL' },
  google_shopping_de: { label: 'Google Shopping DE', code: 'GGL' },
}

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

function labelFor(channel: string) {
  if (MARKETPLACE_LABEL[channel]) return MARKETPLACE_LABEL[channel]
  const code = channel.startsWith('google') ? 'GGL' : channel.startsWith('amazon') ? 'AMZ' : channel.slice(0, 3).toUpperCase()
  const label = channel
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ')
  return { label, code }
}

function parseChannels(param: string | null): string[] | null {
  if (!param) return null
  const list = param
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
  return list.length > 0 ? list : null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const url = new URL(request.url)
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get('limit') || '4', 10) || 4, 1), 50)
    const channels = parseChannels(url.searchParams.get('channel'))
    const wantAggregate = url.searchParams.get('aggregate') === 'true'

    const baseWhere = {
      user_id: userId,
      kind: 'order',
      ...(channels ? { source_channel: { in: channels } } : {}),
    }

    const orders = await prisma.operationalObject.findMany({
      where: baseWhere,
      orderBy: [{ occurred_at: { sort: 'desc', nulls: 'last' } }, { ingested_at: 'desc' }],
      take: limit,
      select: {
        external_id: true,
        source_channel: true,
        sku: true,
        status: true,
        quantity: true,
        amount_cents: true,
        occurred_at: true,
        ingested_at: true,
        raw_payload: true,
      },
    })

    const externalIds = orders.map((o) => o.external_id).filter((v): v is string => Boolean(v))
    const attached = externalIds.length > 0
      ? await prisma.decisionRecord.findMany({
          where: {
            user_id: userId,
            trigger_event_id: { in: externalIds },
            status: { in: ['proposed', 'queued'] },
          },
          select: { trigger_event_id: true },
        })
      : []
    const riskSet = new Set(attached.map((a) => a.trigger_event_id).filter((v): v is string => Boolean(v)))

    const rows: OrderRowDTO[] = orders.map((o) => {
      const payload = (o.raw_payload ?? {}) as Record<string, unknown>
      const payloadStatus = typeof payload.status === 'string' ? payload.status : null
      const rawStatus = (o.status ?? payloadStatus ?? '').toLowerCase()
      const extId = o.external_id ?? ''

      let status: OrderRowDTO['status']
      if (extId && riskSet.has(extId)) {
        status = 'risk_attached'
      } else if (rawStatus === 'fulfilled' || rawStatus === 'shipped' || rawStatus === 'delivered') {
        status = 'fulfilled'
      } else {
        status = 'processing'
      }

      const { label, code } = labelFor(o.source_channel)
      const occurred = o.occurred_at ?? o.ingested_at
      return {
        id: extId || label + '-' + (occurred?.toISOString() ?? ''),
        channel: o.source_channel,
        marketplace_label: label,
        marketplace_code: code,
        amount_eur: (o.amount_cents ?? 0) / 100,
        status,
        items_count: o.quantity ?? 1,
        occurred_at: occurred ? occurred.toISOString() : new Date().toISOString(),
      }
    })

    if (!wantAggregate) {
      return NextResponse.json({ rows })
    }

    const since24h = new Date(Date.now() - DAY_MS)
    const [pendingAction, recent24h] = await Promise.all([
      prisma.decisionRecord.count({
        where: {
          user_id: userId,
          status: { in: ['proposed', 'queued'] },
          ...(channels ? { channel: { in: channels } } : {}),
        },
      }),
      prisma.operationalObject.findMany({
        where: {
          ...baseWhere,
          occurred_at: { gte: since24h },
        },
        select: { status: true, raw_payload: true },
      }),
    ])

    let inTransit = 0
    let delivered24h = 0
    let processing = 0
    for (const row of recent24h) {
      const payload = (row.raw_payload ?? {}) as Record<string, unknown>
      const payloadStatus = typeof payload.status === 'string' ? payload.status : null
      const s = (row.status ?? payloadStatus ?? '').toLowerCase()
      if (s === 'shipped') inTransit += 1
      else if (s === 'delivered') delivered24h += 1
      else processing += 1
    }

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
