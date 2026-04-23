// GET /api/marketplaces/dialogues — list active conversations with messages
// POST /api/marketplaces/dialogues/:id/messages — handled in the subroute

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const userId = await getCurrentUserId()

    const dialogues = await prisma.marketplaceDialogue.findMany({
      where: { user_id: userId },
      orderBy: [{ last_message_at: 'desc' }, { created_at: 'desc' }],
      include: {
        proposal: {
          select: {
            id: true,
            name: true,
            category: true,
            daily_users: true,
            last_year_revenue: true,
            about: true,
            match_score: true,
            risk_signal: true,
            status: true,
          },
        },
        messages: {
          orderBy: { created_at: 'asc' },
        },
      },
    })

    return NextResponse.json({ count: dialogues.length, dialogues })
  } catch (error) {
    console.error('marketplaces dialogues fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load dialogues' },
      { status: 500 },
    )
  }
}
