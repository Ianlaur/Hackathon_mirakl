import { prisma } from '@/lib/prisma'
import { createDecisionLedgerEntry } from '@/lib/leia/ledger'
import { normalizeFounderState } from '@/lib/leia/policy'

export type ChannelRevenue = {
  channel: string
  revenue_cents: number
}

export type ReputationShieldPlan = {
  actionType: 'reputation_shield'
  status: 'auto_executed'
  templateId: 'reputation_shield_v1'
  primaryChannel: string
  secondaryChannels: string[]
  templateInput: {
    primary_channel: string
    secondary_channels: string[]
    secondary_channel_count: number
    founder_returns_on: string
  }
}

export function identifyPrimaryChannel(rows: ChannelRevenue[]) {
  const sorted = rows
    .filter((row) => row.channel && Number.isFinite(Number(row.revenue_cents)))
    .sort((left, right) => Number(right.revenue_cents) - Number(left.revenue_cents))

  return sorted[0]?.channel ?? null
}

export function evaluateReputationShield(args: {
  founderState: string | null | undefined
  founderReturnsOn?: string | null
  channelRevenue: ChannelRevenue[]
}): ReputationShieldPlan | null {
  const founderState = normalizeFounderState(args.founderState)
  const isAway =
    founderState === 'Travelling' || founderState === 'Sick' || founderState === 'Vacation'
  if (!isAway) return null

  const primaryChannel = identifyPrimaryChannel(args.channelRevenue)
  if (!primaryChannel) return null

  const secondaryChannels = args.channelRevenue
    .map((row) => row.channel)
    .filter((channel) => channel && channel !== primaryChannel)
    .sort()
  if (secondaryChannels.length === 0) return null

  return {
    actionType: 'reputation_shield',
    status: 'auto_executed',
    templateId: 'reputation_shield_v1',
    primaryChannel,
    secondaryChannels,
    templateInput: {
      primary_channel: primaryChannel,
      secondary_channels: secondaryChannels,
      secondary_channel_count: secondaryChannels.length,
      founder_returns_on: args.founderReturnsOn ?? '',
    },
  }
}

export async function evaluateReputationShieldForUser(userId: string) {
  const founder = await prisma.founderState.findUnique({
    where: { user_id: userId },
    select: { state: true, until: true },
  })

  const rows = await prisma.$queryRaw<ChannelRevenue[]>`
    SELECT source_channel AS channel, COALESCE(SUM(amount_cents), 0)::int AS revenue_cents
    FROM public.operational_objects
    WHERE user_id = ${userId}::uuid
      AND kind IN ('order', 'orders')
      AND occurred_at >= now() - interval '30 days'
      AND source_channel IS NOT NULL
    GROUP BY source_channel
  `

  const plan = evaluateReputationShield({
    founderState: founder?.state ?? 'Available',
    founderReturnsOn: founder?.until?.toISOString().slice(0, 10) ?? null,
    channelRevenue: rows,
  })
  if (!plan) return null

  const recentRows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
    SELECT COUNT(*) AS count
    FROM public.decision_ledger
    WHERE user_id = ${userId}::uuid
      AND action_type = 'reputation_shield'
      AND created_at >= now() - interval '1 day'
  `
  if (Number(recentRows[0]?.count ?? 0) > 0) return null

  return createDecisionLedgerEntry({
    userId,
    actionType: plan.actionType,
    templateId: plan.templateId,
    templateInput: plan.templateInput,
    rawPayload: {
      primary_channel: plan.primaryChannel,
      paused_channels: plan.secondaryChannels,
      reason: 'founder away reputation shield',
    },
    status: plan.status,
    reversible: true,
    sourceAgent: 'leia',
    triggeredBy: 'founder_context',
  })
}
