import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { buildAutonomySnapshot, buildPauseEverythingConfig } from '@/lib/leia/autonomy-config'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const userId = await getCurrentUserId()
    const rows = buildPauseEverythingConfig()

    await prisma.$transaction(
      rows.map((row) =>
        prisma.autonomyConfig.upsert({
          where: {
            user_id_action_type: {
              user_id: userId,
              action_type: row.action_type,
            },
          },
          update: { mode: row.mode },
          create: {
            user_id: userId,
            action_type: row.action_type,
            mode: row.mode,
          },
        })
      )
    )

    return NextResponse.json({
      ok: true,
      autonomy: buildAutonomySnapshot(rows),
    })
  } catch (error) {
    console.error('autonomy pause-all error:', error)
    return NextResponse.json({ error: 'Failed to pause autonomy' }, { status: 500 })
  }
}
