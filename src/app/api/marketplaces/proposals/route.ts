// GET  /api/marketplaces/proposals     — list proposals + requirements
// PATCH /api/marketplaces/proposals/:id — handled in [id]/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const userId = await getCurrentUserId()

    const proposals = await prisma.marketplaceProposal.findMany({
      where: { user_id: userId },
      orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
      include: {
        requirements: {
          orderBy: { position: 'asc' },
        },
      },
    })

    return NextResponse.json({ count: proposals.length, proposals })
  } catch (error) {
    console.error('marketplaces proposals fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load proposals' },
      { status: 500 },
    )
  }
}
