// MIRA — governance endpoints for the Orb panel.
// Reads and writes autonomy_config directly so the UI can flip modes in <1s.
// Internal codes (observe/propose/auto_execute) are mapped to plain labels
// (Watching/Ask me/Handle it) in the UI per spec UX language rules.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
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

const MODES = ['observe', 'propose', 'auto_execute'] as const

const postSchema = z.object({
  action_type: z.enum(ACTION_TYPES),
  mode: z.enum(MODES),
})

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const [configs, founder] = await Promise.all([
      prisma.autonomyConfig.findMany({ where: { user_id: userId } }),
      prisma.founderState.findUnique({ where: { user_id: userId } }),
    ])
    const byAction = new Map(configs.map((c) => [c.action_type, c.mode]))
    const rows = ACTION_TYPES.map((action_type) => ({
      action_type,
      mode: byAction.get(action_type) ?? 'propose',
    }))
    return NextResponse.json({
      action_types: ACTION_TYPES,
      modes: MODES,
      rows,
      founder: founder
        ? { state: founder.state, until: founder.until?.toISOString() ?? null }
        : { state: 'Active', until: null },
    })
  } catch (error) {
    console.error('autonomy fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load autonomy' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const row = await prisma.autonomyConfig.upsert({
      where: {
        user_id_action_type: { user_id: userId, action_type: parsed.data.action_type },
      },
      create: {
        user_id: userId,
        action_type: parsed.data.action_type,
        mode: parsed.data.mode,
      },
      update: { mode: parsed.data.mode },
    })
    return NextResponse.json({ updated: true, config: row })
  } catch (error) {
    console.error('autonomy update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update autonomy' },
      { status: 500 },
    )
  }
}
