// MIRA — Atlas aggregator. Powers the home-screen map in one round trip.
// Server component data: per-region storefront signals, stock health, ledger summary.
// Numeric aggregations: all counts come from Prisma, not from the LLM.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

// Region mapping: 6 storefronts → 3 countries.
const REGION_OF: Record<string, 'FR' | 'IT' | 'DE'> = {
  amazon_fr: 'FR',
  amazon_it: 'IT',
  amazon_de: 'DE',
  google_shopping_fr: 'FR',
  google_shopping_it: 'IT',
  google_shopping_de: 'DE',
}

const ALL_CHANNELS = Object.keys(REGION_OF)
const DAY_MS = 24 * 60 * 60 * 1000

type StorefrontSignal = {
  channel: string
  region: 'FR' | 'IT' | 'DE'
  orders_24h: number
  revenue_24h: number
  pending_decisions: number
  handled_24h: number
  shielded: boolean
}

type RegionSignal = {
  region: 'FR' | 'IT' | 'DE'
  orders_24h: number
  revenue_24h: number
  pending_decisions: number
  handled_24h: number
  shielded: boolean
  storefronts: StorefrontSignal[]
}

export async function GET(_request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const since24h = new Date(Date.now() - DAY_MS)

    const [ordersByChannel, pendingDecisions, handledByChannel, stockSummary, founder, latestShield, activeOversells] =
      await Promise.all([
        prisma.operationalObject.groupBy({
          by: ['source_channel'],
          where: {
            user_id: userId,
            kind: 'order',
            occurred_at: { gte: since24h },
          },
          _count: { _all: true },
          _sum: { amount_cents: true },
        }),
        prisma.decisionRecord.findMany({
          where: {
            user_id: userId,
            status: { in: ['proposed', 'queued'] },
          },
          select: { channel: true, sku: true, template_id: true },
        }),
        prisma.decisionRecord.groupBy({
          by: ['channel'],
          where: {
            user_id: userId,
            status: 'auto_executed',
            created_at: { gte: since24h },
          },
          _count: { _all: true },
        }),
        prisma.stockState.findMany({
          where: { user_id: userId },
          select: { sku: true, on_hand: true, velocity_per_week: true },
        }),
        prisma.founderState.findUnique({ where: { user_id: userId } }),
        prisma.decisionRecord.findFirst({
          where: { user_id: userId, template_id: 'reputation_shield_v1' },
          orderBy: { created_at: 'desc' },
          select: { raw_payload: true, created_at: true },
        }),
        prisma.decisionRecord.findMany({
          where: {
            user_id: userId,
            status: { in: ['proposed', 'auto_executed', 'queued'] },
            created_at: { gte: new Date(Date.now() - 60 * 60_000) },
            OR: [
              { template_id: 'oversell_risk_v1' },
              // Vacation-wrapped oversells keep their origin in raw_payload.request.action_type.
              { AND: [{ template_id: 'vacation_queue_v1' }, { raw_payload: { path: ['request', 'action_type'], equals: 'flag_oversell' } }] },
            ],
          },
          orderBy: { created_at: 'desc' },
          select: { sku: true, channel: true, raw_payload: true, created_at: true, template_id: true },
          take: 5,
        }),
      ])

    const ordersIdx = new Map<string, { count: number; revenue_cents: number }>()
    for (const row of ordersByChannel) {
      ordersIdx.set(row.source_channel, {
        count: row._count._all,
        revenue_cents: row._sum.amount_cents ?? 0,
      })
    }

    const handledIdx = new Map<string, number>()
    for (const row of handledByChannel) {
      if (row.channel) handledIdx.set(row.channel, row._count._all)
    }

    const pendingByChannel = new Map<string, number>()
    for (const d of pendingDecisions) {
      const key = d.channel ?? 'unknown'
      pendingByChannel.set(key, (pendingByChannel.get(key) ?? 0) + 1)
    }

    const shieldPayload = latestShield?.raw_payload as
      | { primary_channel?: string; paused_channels?: string[] }
      | null
      | undefined
    const shieldedSet = new Set<string>(shieldPayload?.paused_channels ?? [])
    const isFounderAway = founder?.state === 'Vacation' || founder?.state === 'Sick'

    const storefronts: StorefrontSignal[] = ALL_CHANNELS.map((channel) => {
      const orders = ordersIdx.get(channel)
      return {
        channel,
        region: REGION_OF[channel],
        orders_24h: orders?.count ?? 0,
        revenue_24h: orders ? orders.revenue_cents / 100 : 0,
        pending_decisions: pendingByChannel.get(channel) ?? 0,
        handled_24h: handledIdx.get(channel) ?? 0,
        shielded: isFounderAway && shieldedSet.has(channel),
      }
    })

    const regions: RegionSignal[] = (['FR', 'IT', 'DE'] as const).map((region) => {
      const rows = storefronts.filter((s) => s.region === region)
      const sum = (pick: (s: StorefrontSignal) => number) => rows.reduce((n, s) => n + pick(s), 0)
      return {
        region,
        orders_24h: sum((s) => s.orders_24h),
        revenue_24h: Number(sum((s) => s.revenue_24h).toFixed(2)),
        pending_decisions: sum((s) => s.pending_decisions),
        handled_24h: sum((s) => s.handled_24h),
        shielded: rows.some((s) => s.shielded),
        storefronts: rows,
      }
    })

    // Stock health: share of SKUs with < 7 days of cover at current velocity.
    let atRisk = 0
    for (const s of stockSummary) {
      const perWeek = Number(s.velocity_per_week)
      if (perWeek <= 0) continue
      const perDay = perWeek / 7
      const days = s.on_hand / perDay
      if (days < 7) atRisk += 1
    }
    const healthy = stockSummary.length - atRisk
    const stock_health_pct = stockSummary.length > 0 ? Math.round((healthy / stockSummary.length) * 100) : 100

    const oversells = activeOversells.map((d) => {
      // For vacation-wrapped decisions, sku/channel live on the top-level row,
      // but the source_region can also be resolved from raw_payload.request.channel.
      const payload = (d.raw_payload ?? {}) as Record<string, unknown>
      const request = (payload.request ?? {}) as Record<string, unknown>
      const channel = d.channel ?? (typeof request.channel === 'string' ? request.channel : null)
      const sku = d.sku ?? (typeof request.sku === 'string' ? request.sku : null)
      return {
        sku,
        source_channel: channel,
        source_region: channel ? REGION_OF[channel] ?? null : null,
        created_at: d.created_at.toISOString(),
      }
    })
    const oversellActive = oversells.length > 0

    return NextResponse.json({
      updated_at: new Date().toISOString(),
      founder: {
        state: founder?.state ?? 'Active',
        until: founder?.until?.toISOString() ?? null,
      },
      oversell: {
        active: oversellActive,
        count: oversells.length,
        items: oversells,
      },
      shield: shieldPayload
        ? {
            primary_channel: shieldPayload.primary_channel ?? null,
            paused_channels: shieldPayload.paused_channels ?? [],
            activated_at: latestShield?.created_at?.toISOString() ?? null,
            active: isFounderAway,
          }
        : { primary_channel: null, paused_channels: [], activated_at: null, active: false },
      stock: {
        total_skus: stockSummary.length,
        at_risk: atRisk,
        healthy,
        health_pct: stock_health_pct,
      },
      totals: {
        orders_24h: storefronts.reduce((n, s) => n + s.orders_24h, 0),
        revenue_24h: Number(storefronts.reduce((n, s) => n + s.revenue_24h, 0).toFixed(2)),
        pending_decisions: pendingDecisions.length,
        handled_24h: Array.from(handledIdx.values()).reduce((n, v) => n + v, 0),
      },
      regions,
    })
  } catch (error) {
    console.error('atlas fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load atlas' },
      { status: 500 },
    )
  }
}
