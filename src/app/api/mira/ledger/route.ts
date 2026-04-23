import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const limitParam = new URL(request.url).searchParams.get('limit')
    const statusParam = new URL(request.url).searchParams.get('status')
    const limit = Math.min(Math.max(Number.parseInt(limitParam || '20', 10) || 20, 1), 200)

    const decisions = await prisma.decisionRecord.findMany({
      where: {
        user_id: userId,
        ...(statusParam ? { status: statusParam } : {}),
      },
      orderBy: { created_at: 'desc' },
      take: limit,
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

    return NextResponse.json({ count: decisions.length, decisions })
  } catch (error) {
    console.error('ledger fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load ledger' },
      { status: 500 },
    )
  }
}
