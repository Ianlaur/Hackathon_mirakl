import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getCurrentUserId } from '@/lib/session'
import { serializeJson } from '@/lib/copilot'
import PlanningPageClient from './PlanningPageClient'

export const dynamic = 'force-dynamic'

function isMissingTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021'
  )
}

function isDatabaseUnavailableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true
  }

  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.message.includes('Environment variable not found: DATABASE_URL') ||
    error.message.includes("Can't reach database server") ||
    error.message.includes('Invalid `prisma.')
  )
}

function isMissingDelegateError(error: unknown) {
  if (!(error instanceof TypeError)) {
    return false
  }

  return (
    error.message.includes("Cannot read properties of undefined") &&
    (error.message.includes("'findMany'") || error.message.includes("'findUnique'"))
  )
}

async function fallbackIfTableMissing<T>(query: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await query()
  } catch (error) {
    if (
      isMissingTableError(error) ||
      isDatabaseUnavailableError(error) ||
      isMissingDelegateError(error)
    ) {
      return fallback
    }
    throw error
  }
}

export default async function PlanningPage() {
  const userId = await getCurrentUserId()

  const [events, signals, recommendations] = await Promise.all([
    fallbackIfTableMissing(
      () =>
        prisma.merchantCalendarEvent.findMany({
          where: { user_id: userId },
          orderBy: { start_date: 'asc' },
          take: 20,
        }),
      []
    ),
    fallbackIfTableMissing(
      () =>
        prisma.externalContextSignal.findMany({
          where: { user_id: userId },
          include: { recommendation: true },
          orderBy: [{ relevance_score: 'desc' }, { created_at: 'desc' }],
          take: 20,
        }),
      []
    ),
    fallbackIfTableMissing(
      () =>
        prisma.agentRecommendation.findMany({
          where: { user_id: userId, scenario_type: { in: ['calendar_absence', 'demand_event'] } },
          orderBy: { created_at: 'desc' },
          take: 12,
        }),
      []
    ),
  ])

  return (
    <PlanningPageClient
      events={events.map((event) => ({
        ...event,
        start_date: event.start_date.toISOString(),
        end_date: event.end_date.toISOString(),
        created_at: event.created_at.toISOString(),
        updated_at: event.updated_at.toISOString(),
      }))}
      signals={signals.map((signal) => ({
        ...signal,
        starts_at: signal.starts_at?.toISOString() || null,
        ends_at: signal.ends_at?.toISOString() || null,
        created_at: signal.created_at.toISOString(),
        updated_at: signal.updated_at.toISOString(),
        evidence_payload: serializeJson(signal.evidence_payload),
        recommendation: signal.recommendation
          ? {
              ...signal.recommendation,
              created_at: signal.recommendation.created_at.toISOString(),
              updated_at: signal.recommendation.updated_at.toISOString(),
            }
          : null,
      }))}
      recommendations={recommendations.map((recommendation) => ({
        ...recommendation,
        created_at: recommendation.created_at.toISOString(),
        updated_at: recommendation.updated_at.toISOString(),
      }))}
    />
  )
}
