import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

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

    const [updatedRecommendation] = await prisma.$transaction([
      prisma.agentRecommendation.update({
        where: { id: recommendation.id },
        data: {
          status: 'rejected',
        },
      }),
      prisma.recommendationApproval.create({
        data: {
          recommendation_id: recommendation.id,
          user_id: userId,
          status: 'rejected',
          comment,
        },
      }),
    ])

    return NextResponse.json({ recommendation: updatedRecommendation })
  } catch (error) {
    console.error('Error rejecting recommendation:', error)
    return NextResponse.json({ error: 'Failed to reject recommendation' }, { status: 500 })
  }
}
