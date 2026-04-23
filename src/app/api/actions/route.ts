// Adapter endpoint: exposes MIRA decision_ledger in the RecommendationDTO shape
// expected by ActionsPageClient. Keeps the UI component contract unchanged.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import {
  decisionToRecommendation,
  type DecisionRecordInput,
} from '@/lib/mira/adapters/decisionToRecommendation'

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

export async function GET(_request: NextRequest) {
  try {
    const userId = await getCurrentUserId()

    const decisions = await prisma.decisionRecord.findMany({
      where: { user_id: userId },
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

    const sorted = [...decisions].sort((a, b) => {
      const pa = PRIORITY_STATUS_ORDER[a.status] ?? 99
      const pb = PRIORITY_STATUS_ORDER[b.status] ?? 99
      if (pa !== pb) return pa - pb
      return b.created_at.getTime() - a.created_at.getTime()
    })

    const recommendations = sorted.map((d) => decisionToRecommendation(d as DecisionRecordInput))

    return NextResponse.json({ count: recommendations.length, recommendations })
  } catch (error) {
    console.error('actions adapter error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load actions' },
      { status: 500 },
    )
  }
}
