import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { serializeJson } from '@/lib/serialize'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const PRIORITY_STATUS_ORDER: Record<string, number> = {
  pending_approval: 0,
  approved: 1,
  rejected: 2,
  executed: 3,
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const status = new URL(request.url).searchParams.get('status')

    const recommendations = await prisma.agentRecommendation.findMany({
      where: {
        user_id: userId,
        ...(status ? { status } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    })

    const serialized = recommendations
      .map((recommendation) => ({
        ...recommendation,
        evidence_payload: serializeJson(recommendation.evidence_payload),
        action_payload: serializeJson(recommendation.action_payload),
        created_at: recommendation.created_at.toISOString(),
        updated_at: recommendation.updated_at.toISOString(),
      }))
      .sort((left, right) => {
        const leftPriority = PRIORITY_STATUS_ORDER[left.status] ?? 99
        const rightPriority = PRIORITY_STATUS_ORDER[right.status] ?? 99

        if (leftPriority !== rightPriority) return leftPriority - rightPriority
        return right.created_at.localeCompare(left.created_at)
      })

    return NextResponse.json({ recommendations: serialized })
  } catch (error) {
    console.error('actions adapter error:', error)
    return NextResponse.json({ recommendations: [] }, { status: 200 })
  }
}
