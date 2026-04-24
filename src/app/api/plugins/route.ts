import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/session'
import {
  listPluginInstallationSnapshot,
  setPluginInstallations,
} from '@/lib/plugin-installations'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  plugins: z.array(z.string()).default([]),
})

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const snapshot = await listPluginInstallationSnapshot(userId)
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error('plugins GET error:', error)
    return NextResponse.json({ error: 'Failed to load plugins' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid plugin payload' }, { status: 400 })
    }

    const snapshot = await setPluginInstallations(userId, parsed.data.plugins)
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error('plugins POST error:', error)
    return NextResponse.json({ error: 'Failed to update plugins' }, { status: 500 })
  }
}
