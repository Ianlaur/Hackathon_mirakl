import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getCurrentUserId } from '@/lib/session'
import { getCopilotConfig, serializeJson } from '@/lib/copilot'
import CopilotPageClient from './CopilotPageClient'

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

export default async function CopilotPage() {
  const userId = await getCurrentUserId()

  const [config, sessions, recommendations, executions] = await Promise.all([
    getCopilotConfig(userId),
    fallbackIfTableMissing(
      () =>
        prisma.copilotChatSession.findMany({
          where: { user_id: userId },
          include: {
            messages: {
              orderBy: { created_at: 'asc' },
            },
          },
          orderBy: { last_message_at: 'desc' },
          take: 10,
        }),
      []
    ),
    fallbackIfTableMissing(
      () =>
        prisma.agentRecommendation.findMany({
          where: { user_id: userId },
          include: {
            approvals: {
              orderBy: { created_at: 'desc' },
              take: 1,
            },
            execution_runs: {
              orderBy: { created_at: 'desc' },
              take: 1,
            },
          },
          orderBy: { created_at: 'desc' },
          take: 12,
        }),
      []
    ),
    fallbackIfTableMissing(
      () =>
        prisma.agentExecutionRun.findMany({
          where: { user_id: userId },
          orderBy: { created_at: 'desc' },
          take: 12,
        }),
      []
    ),
  ])

  const serializedSessions = sessions.map((session) => ({
    ...session,
    last_message_at: session.last_message_at.toISOString(),
    created_at: session.created_at.toISOString(),
    updated_at: session.updated_at.toISOString(),
    messages: session.messages.map((message) => ({
      ...message,
      created_at: message.created_at.toISOString(),
      evidence_payload: serializeJson(message.evidence_payload),
    })),
  }))

  const serializedRecommendations = recommendations.map((recommendation) => ({
    ...recommendation,
    created_at: recommendation.created_at.toISOString(),
    updated_at: recommendation.updated_at.toISOString(),
    evidence_payload: serializeJson(recommendation.evidence_payload),
    action_payload: serializeJson(recommendation.action_payload),
    approvals: recommendation.approvals.map((approval) => ({
      ...approval,
      created_at: approval.created_at.toISOString(),
    })),
    execution_runs: recommendation.execution_runs.map((run) => ({
      ...run,
      created_at: run.created_at.toISOString(),
      updated_at: run.updated_at.toISOString(),
      executed_at: run.executed_at?.toISOString() || null,
      payload: serializeJson(run.payload),
    })),
  }))

  const serializedExecutions = executions.map((run) => ({
    ...run,
    created_at: run.created_at.toISOString(),
    updated_at: run.updated_at.toISOString(),
    executed_at: run.executed_at?.toISOString() || null,
    payload: serializeJson(run.payload),
  }))

  return (
    <CopilotPageClient
      config={config}
      sessions={serializedSessions}
      recommendations={serializedRecommendations}
      executions={serializedExecutions}
    />
  )
}
