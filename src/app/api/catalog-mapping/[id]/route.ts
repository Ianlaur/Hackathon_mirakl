import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { updateCatalogReviewRecord } from '@/lib/catalog-review-records'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const updateSchema = z.object({
  status: z.enum(['pending', 'approved', 'modified', 'rejected']),
  proposed_value: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId()
    const payload = updateSchema.parse(await request.json())
    const record = await updateCatalogReviewRecord({
      userId,
      id: params.id,
      status: payload.status,
      proposedValue: payload.proposed_value,
    })

    if (!record) {
      return NextResponse.json({ error: 'Catalog mapping not found' }, { status: 404 })
    }

    return NextResponse.json({ record })
  } catch (error) {
    console.error('catalog mapping PATCH error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update catalog mapping' }, { status: 500 })
  }
}
