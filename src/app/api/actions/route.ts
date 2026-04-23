// Leia — adapter endpoint. Serves decision_ledger rows in RecommendationDTO shape
// so /actions UI (originally designed for the copilot vacation planner) can render them.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { decisionToRecommendation } from '@/lib/mira/adapters/decisionToRecommendation'

export const dynamic = 'force-dynamic'

const PRIORITY_STATUS_ORDER: Record<string, number> = {
  proposed: 0,
  queued: 1,
  auto_executed: 2,
  overridden: 3,
  approved: 4,
  rejected: 5,
  skipped: 6,
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const status = new URL(request.url).searchParams.get('status')

    const decisions = await prisma.decisionRecord.findMany({
      where: {
        user_id: userId,
        ...(status ? { status } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: {
        id: true,
        sku: true,
        channel: true,
        action_type: true,
        template_id: true,
        logical_inference: true,
        raw_payload: true,
        status: true,
        reversible: true,
        source_agent: true,
        triggered_by: true,
        trigger_event_id: true,
        created_at: true,
        executed_at: true,
        founder_decision_at: true,
      },
    })

    const recommendations = decisions
      .map((d) => decisionToRecommendation(d))
      .sort((a, b) => {
        const pa = PRIORITY_STATUS_ORDER[a.status] ?? 99
        const pb = PRIORITY_STATUS_ORDER[b.status] ?? 99
        if (pa !== pb) return pa - pb
        return b.created_at.localeCompare(a.created_at)
      })

    return NextResponse.json({ recommendations })
  } catch (error) {
    console.error('actions adapter error:', error)
    return NextResponse.json({ recommendations: [] }, { status: 200 })
  }
}
