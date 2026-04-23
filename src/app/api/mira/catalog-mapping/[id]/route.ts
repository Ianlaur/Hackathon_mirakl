// MIRA — F1 catalog review resolution. Founder approves / rejects a mapping
// proposal. Only updates catalog_review_records.status — no ledger write.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  status: z.enum(['approved', 'rejected', 'pending']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getCurrentUserId()
    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const row = await prisma.catalogReviewRecord.updateMany({
      where: { id: params.id, user_id: userId },
      data: { status: parsed.data.status },
    })
    if (row.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ updated: true, status: parsed.data.status })
  } catch (error) {
    console.error('catalog-mapping patch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Update failed' },
      { status: 500 },
    )
  }
}
