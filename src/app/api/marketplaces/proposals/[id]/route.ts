// PATCH /api/marketplaces/proposals/:id
// Body: { action: 'accept' | 'decline' }
// accept → status='accepted', spawn a dialogue if none, decided_at=now
// decline → status='declined', decided_at=now

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  action: z.enum(['accept', 'decline']),
})

const paramsSchema = z.object({
  id: z.string().uuid(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = paramsSchema.parse(params)
    const { action } = patchSchema.parse(await request.json())

    const proposal = await prisma.marketplaceProposal.findFirst({
      where: { id, user_id: userId },
      select: { id: true, status: true, name: true },
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const nextStatus = action === 'accept' ? 'accepted' : 'declined'
    const now = new Date()

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.marketplaceProposal.update({
        where: { id: proposal.id },
        data: { status: nextStatus, decided_at: now },
        include: { requirements: { orderBy: { position: 'asc' } } },
      })

      if (action === 'accept') {
        const existingDialogue = await tx.marketplaceDialogue.findFirst({
          where: { user_id: userId, proposal_id: p.id },
          select: { id: true },
        })
        if (!existingDialogue) {
          await tx.marketplaceDialogue.create({
            data: {
              user_id: userId,
              proposal_id: p.id,
              counterpart_name: p.name,
            },
          })
        }
      }

      return p
    })

    return NextResponse.json({ proposal: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid request' },
        { status: 400 },
      )
    }
    console.error('marketplace proposal mutation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update proposal' },
      { status: 500 },
    )
  }
}
