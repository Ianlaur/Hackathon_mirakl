import { NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/session'
import { runSafetyFuseScanForUser } from '@/lib/leia/safety-fuse'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const userId = await getCurrentUserId()
    const rows = await runSafetyFuseScanForUser(userId)

    return NextResponse.json({
      ok: true,
      created: rows.map((row) => ({
        id: row.id,
        sku: row.sku,
        status: row.status,
        reasoning: row.logical_inference,
      })),
    })
  } catch (error) {
    console.error('safety fuse scan error:', error)
    return NextResponse.json({ error: 'Failed to scan safety fuses' }, { status: 500 })
  }
}
