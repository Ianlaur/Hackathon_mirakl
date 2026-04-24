import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { buildAutonomySnapshot } from '@/lib/mira/autonomy-config'
import { getFounderContextForUser } from '@/lib/mira/founder-context'
import { normalizeAutonomyMode } from '@/lib/mira/policy'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  action_type: z.string().trim().min(1),
  mode: z.string().trim().min(1),
})

async function recentFuseCount(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
    SELECT COUNT(*) AS count
    FROM public.decision_ledger
    WHERE user_id = ${userId}::uuid
      AND template_id = 'fuse_tripped_v1'
      AND created_at >= now() - interval '7 days'
  `

  return Number(rows[0]?.count ?? 0)
}

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const [rows, founderContext, fuseCount] = await Promise.all([
      prisma.autonomyConfig.findMany({
        where: { user_id: userId },
        select: { action_type: true, mode: true },
      }),
      getFounderContextForUser(userId),
      recentFuseCount(userId),
    ])

    return NextResponse.json({
      autonomy: buildAutonomySnapshot(rows),
      founder_context: founderContext,
      safety_fuse: {
        recent_trips_7d: fuseCount,
        tripped: fuseCount > 0,
      },
    })
  } catch (error) {
    console.error('autonomy GET error:', error)
    return NextResponse.json({ error: 'Failed to load autonomy config' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const payload = updateSchema.parse(await request.json())
    const mode = normalizeAutonomyMode(payload.mode)

    const row = await prisma.autonomyConfig.upsert({
      where: {
        user_id_action_type: {
          user_id: userId,
          action_type: payload.action_type,
        },
      },
      update: { mode },
      create: {
        user_id: userId,
        action_type: payload.action_type,
        mode,
      },
    })

    return NextResponse.json({
      ok: true,
      item: buildAutonomySnapshot([{ action_type: row.action_type, mode: row.mode }]).items.find(
        (item) => item.action_type === row.action_type
      ),
    })
  } catch (error) {
    console.error('autonomy POST error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update autonomy config' }, { status: 500 })
  }
}
