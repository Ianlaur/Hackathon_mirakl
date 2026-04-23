import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type LeaveRow = { id: string; user_id: string }

export async function GET(request: Request) {
  try {
    const now = new Date()
    const in30d = new Date(Date.now() + 30 * 24 * 3600 * 1000)

    const leaves = await prisma.$queryRaw<LeaveRow[]>`
      SELECT id, user_id
      FROM public.calendar_events
      WHERE kind = 'leave'
        AND start_at >= ${now}
        AND start_at <= ${in30d}
    `

    const origin = new URL(request.url).origin
    const results: Array<{ event_id: string; ok: boolean }> = []

    for (const leave of leaves) {
      const resp = await fetch(`${origin}/api/agent/calendar-advisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: leave.id, user_id: leave.user_id }),
      })
      results.push({ event_id: leave.id, ok: resp.ok })
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (error) {
    console.error('refresh error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
