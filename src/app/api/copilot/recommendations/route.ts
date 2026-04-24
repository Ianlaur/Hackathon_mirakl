import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { serializeJson } from '@/lib/serialize'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function isMissingTableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021' || error.code === 'P2022') {
      return true
    }

    if (error.code === 'P2010') {
      const meta = error.meta as { code?: string; message?: string } | undefined
      return meta?.code === '42P01' || meta?.code === '42703'
    }
  }

  if (!(error instanceof Error)) return false
  const message = error.message.toLowerCase()
  return (
    message.includes('does not exist') ||
    message.includes('relation') ||
    message.includes('column')
  )
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const status = new URL(request.url).searchParams.get('status')
    const where = {
      user_id: userId,
      ...(status ? { status } : {}),
    }

    try {
      const recommendations = await prisma.agentRecommendation.findMany({
        where,
        include: {
          approvals: {
            orderBy: { created_at: 'desc' },
            take: 1,
          },
          execution_runs: {
            orderBy: { created_at: 'desc' },
            take: 3,
          },
        },
        orderBy: { created_at: 'desc' },
        take: 25,
      })

      return NextResponse.json({
        recommendations: recommendations.map((recommendation) => ({
          ...recommendation,
          evidence_payload: serializeJson(recommendation.evidence_payload),
          action_payload: serializeJson(recommendation.action_payload),
        })),
      })
    } catch (error) {
      if (!isMissingTableError(error)) {
        throw error
      }

      // Fallback when approval/execution tables are not deployed yet.
      const recommendations = await prisma.agentRecommendation.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: 25,
      })

      return NextResponse.json({
        recommendations: recommendations.map((recommendation) => ({
          ...recommendation,
          approvals: [],
          execution_runs: [],
          evidence_payload: serializeJson(recommendation.evidence_payload),
          action_payload: serializeJson(recommendation.action_payload),
        })),
      })
    }
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json({
        recommendations: [],
        warning:
          'Copilot recommendation tables are not deployed yet. Run `npm run db:push` and `npm run db:prepare`.',
      })
    }
    console.error('Error fetching recommendations:', error)
    return NextResponse.json({ error: 'Failed to load recommendations' }, { status: 500 })
  }
}
