// MIRA — morning briefing built from real ingested data + the decision ledger.
// Satisfies DoD #3: when the founder is on Vacation/Sick, the digest explicitly reports
// what was queued and why.

import type { PrismaClient } from '@prisma/client'

export type MiraBriefing = {
  dateLabel: string
  founder: {
    state: string
    until: string | null
    is_away: boolean
  }
  summary: string
  counts: {
    orders_last_24h: number
    decisions_last_24h: number
    queued: number
    proposed: number
    auto_executed: number
  }
  queued_decisions: Array<{
    id: string
    sku: string | null
    template_id: string
    logical_inference: string
    created_at: string
  }>
  needs_attention: Array<{
    id: string
    sku: string | null
    template_id: string
    logical_inference: string
    created_at: string
  }>
  stockout_watch: Array<{
    sku: string
    on_hand: number
    velocity_per_week: number
    days_to_stockout: number
  }>
}

function dateLabelFR(now = new Date()): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)
}

function buildSummary(
  founder: { state: string; is_away: boolean; until: string | null },
  counts: MiraBriefing['counts'],
  stockout: MiraBriefing['stockout_watch'],
): string {
  if (founder.is_away) {
    const returnStr = founder.until ? ` Retour prévu ${founder.until.slice(0, 10)}.` : ''
    return `${founder.state}. ${counts.queued} décision(s) en file, ${counts.auto_executed} gérée(s), ${counts.proposed} en attente.${returnStr}`
  }

  const imminent = stockout.filter((s) => s.days_to_stockout <= 7).length
  const parts: string[] = []
  if (counts.proposed > 0) parts.push(`${counts.proposed} décision(s) à trancher`)
  if (imminent > 0) parts.push(`${imminent} SKU à moins de 7 jours de rupture`)
  if (counts.auto_executed > 0) parts.push(`${counts.auto_executed} action(s) exécutée(s) sur 24h`)
  if (parts.length === 0) return 'Rien d’urgent ce matin. Tout roule.'
  return parts.join('. ') + '.'
}

export async function buildMiraBriefing(
  prisma: PrismaClient,
  userId: string,
): Promise<MiraBriefing> {
  const since = new Date(Date.now() - 24 * 3600_000)

  const [founderRow, ordersCount, decisions, stockStates] = await Promise.all([
    prisma.founderState.findUnique({ where: { user_id: userId } }),
    prisma.operationalObject.count({
      where: { user_id: userId, kind: 'order', occurred_at: { gte: since } },
    }),
    prisma.decisionRecord.findMany({
      where: { user_id: userId, created_at: { gte: since } },
      orderBy: { created_at: 'desc' },
      take: 100,
      select: {
        id: true,
        sku: true,
        template_id: true,
        logical_inference: true,
        status: true,
        created_at: true,
      },
    }),
    prisma.stockState.findMany({
      where: { user_id: userId },
      orderBy: [{ on_hand: 'asc' }],
      take: 50,
    }),
  ])

  const founderState = (founderRow?.state as string) ?? 'Active'
  const isAway = founderState === 'Vacation' || founderState === 'Sick'

  const queued = decisions.filter((d) => d.status === 'queued')
  const proposed = decisions.filter((d) => d.status === 'proposed')
  const auto = decisions.filter((d) => d.status === 'auto_executed')

  const stockoutWatch: MiraBriefing['stockout_watch'] = []
  for (const s of stockStates) {
    const perWeek = Number(s.velocity_per_week)
    if (perWeek <= 0 || s.on_hand <= 0) continue
    const days = s.on_hand / (perWeek / 7)
    if (days <= 14) {
      stockoutWatch.push({
        sku: s.sku,
        on_hand: s.on_hand,
        velocity_per_week: perWeek,
        days_to_stockout: Number(days.toFixed(1)),
      })
    }
  }
  stockoutWatch.sort((a, b) => a.days_to_stockout - b.days_to_stockout)

  const counts = {
    orders_last_24h: ordersCount,
    decisions_last_24h: decisions.length,
    queued: queued.length,
    proposed: proposed.length,
    auto_executed: auto.length,
  }

  const founder = {
    state: founderState,
    until: founderRow?.until ? founderRow.until.toISOString() : null,
    is_away: isAway,
  }

  return {
    dateLabel: dateLabelFR(),
    founder,
    summary: buildSummary(founder, counts, stockoutWatch),
    counts,
    queued_decisions: queued.slice(0, 10).map((d) => ({
      id: d.id,
      sku: d.sku,
      template_id: d.template_id,
      logical_inference: d.logical_inference,
      created_at: d.created_at.toISOString(),
    })),
    needs_attention: proposed.slice(0, 10).map((d) => ({
      id: d.id,
      sku: d.sku,
      template_id: d.template_id,
      logical_inference: d.logical_inference,
      created_at: d.created_at.toISOString(),
    })),
    stockout_watch: stockoutWatch.slice(0, 10),
  }
}
