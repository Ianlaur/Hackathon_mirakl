import { NextResponse } from 'next/server'
import { getDayBriefing } from '@/lib/dust'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const briefing = await getDayBriefing()
    return NextResponse.json({ briefing })
  } catch (error) {
    console.error('Briefing route error:', error)
    return NextResponse.json(
      { error: 'Impossible de recuperer les informations du jour.' },
      { status: 500 }
    )
  }
}
