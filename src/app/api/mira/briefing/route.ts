import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { buildMiraBriefing } from '@/lib/mira/briefing'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const briefing = await buildMiraBriefing(prisma, userId)
    return NextResponse.json(briefing)
  } catch (error) {
    console.error('MIRA briefing error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to build briefing' },
      { status: 500 },
    )
  }
}
