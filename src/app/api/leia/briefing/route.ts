import { NextResponse } from 'next/server'
import { buildMorningBriefingForUser } from '@/lib/leia/briefing'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const briefing = await buildMorningBriefingForUser(userId)

    return NextResponse.json({ briefing })
  } catch (error) {
    console.error('briefing error:', error)
    return NextResponse.json({ error: 'Failed to build briefing' }, { status: 500 })
  }
}
