import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { serializeJson } from '@/lib/copilot'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const status = new URL(request.url).searchParams.get('status')

    const recommendations = await prisma.agentRecommendation.findMany({
      where: {
        user_id: userId,
        ...(status ? { status } : {}),
      },
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
    console.error('Error fetching recommendations:', error)
    return NextResponse.json({ error: 'Failed to load recommendations' }, { status: 500 })
  }
}
