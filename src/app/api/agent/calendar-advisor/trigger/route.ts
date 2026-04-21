import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  event_id: z.string().uuid(),
})

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const url = new URL(request.url)
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing event_id query param' }, { status: 400 })
    }

    const proxyResp = await fetch(`${url.origin}/api/agent/calendar-advisor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: parsed.data.event_id, user_id: userId }),
    })

    const data = await proxyResp.json()
    return NextResponse.json(data, { status: proxyResp.status })
  } catch (error) {
    console.error('trigger error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
