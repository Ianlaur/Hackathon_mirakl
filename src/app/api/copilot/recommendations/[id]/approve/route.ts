import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

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

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json().catch(() => ({}))
    const comment = typeof body.comment === 'string' ? body.comment : null

    const recommendation = await prisma.agentRecommendation.findFirst({
      where: { id: params.id, user_id: userId },
    })

    if (!recommendation) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 })
    }

    let updatedRecommendation
    try {
      ;[updatedRecommendation] = await prisma.$transaction([
        prisma.agentRecommendation.update({
          where: { id: recommendation.id },
          data: {
            status: 'approved',
          },
        }),
        prisma.recommendationApproval.create({
          data: {
            recommendation_id: recommendation.id,
            user_id: userId,
            status: 'approved',
            comment,
          },
        }),
        prisma.agentExecutionRun.create({
          data: {
            recommendation_id: recommendation.id,
            user_id: userId,
            status: 'queued',
            target:
              typeof recommendation.action_payload === 'object' &&
              recommendation.action_payload &&
              'target' in recommendation.action_payload
                ? String((recommendation.action_payload as any).target)
                : 'manual_review',
            payload: recommendation.action_payload,
            result_summary: 'Merchant approved the action. Ready for downstream execution.',
          },
        }),
      ])
    } catch (error) {
      if (!isMissingTableError(error)) {
        throw error
      }

      // Fallback when log/execution tables are not deployed yet.
      updatedRecommendation = await prisma.agentRecommendation.update({
        where: { id: recommendation.id },
        data: {
          status: 'approved',
        },
      })
    }

    return NextResponse.json({ recommendation: updatedRecommendation })
  } catch (error) {
    console.error('Error approving recommendation:', error)
    return NextResponse.json({ error: 'Failed to approve recommendation' }, { status: 500 })
  }
}
