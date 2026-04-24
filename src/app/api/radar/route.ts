import { NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/session'
import { getRadarSnapshot } from '@/lib/mira/supplier-losses'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const snapshot = await getRadarSnapshot(userId)
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error('radar snapshot error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
