// MIRA — "Pause everything" one-tap: sets every action_type autonomy to observe.
// Conservative default per spec. No LLM involved.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const ACTION_TYPES = [
  'pause_listing',
  'resume_listing',
  'propose_restock',
  'adjust_buffer',
  'flag_returns_pattern',
  'flag_reconciliation_variance',
  'calendar_buffer',
] as const

export async function POST() {
  try {
    const userId = await getCurrentUserId()
    await prisma.$transaction(
      ACTION_TYPES.map((action_type) =>
        prisma.autonomyConfig.upsert({
          where: { user_id_action_type: { user_id: userId, action_type } },
          create: { user_id: userId, action_type, mode: 'observe' },
          update: { mode: 'observe' },
        }),
      ),
    )
    return NextResponse.json({ paused: true, count: ACTION_TYPES.length })
  } catch (error) {
    console.error('pause-all error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to pause everything' },
      { status: 500 },
    )
  }
}
