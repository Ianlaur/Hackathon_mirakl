import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  body: z.string().min(1).max(4000),
  sender: z.enum(['founder', 'counterpart', 'mira']).default('founder'),
  autopilot: z.boolean().optional(),
})

const paramsSchema = z.object({
  id: z.string().uuid(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = paramsSchema.parse(params)
    const input = bodySchema.parse(await request.json())

    const dialogue = await prisma.marketplaceDialogue.findFirst({
      where: { id, user_id: userId },
      select: { id: true },
    })

    if (!dialogue) {
      return NextResponse.json({ error: 'Dialogue not found' }, { status: 404 })
    }

    const message = await prisma.$transaction(async (tx) => {
      const m = await tx.marketplaceMessage.create({
        data: {
          dialogue_id: dialogue.id,
          sender: input.sender,
          body: input.body,
          autopilot: input.autopilot ?? false,
        },
      })
      await tx.marketplaceDialogue.update({
        where: { id: dialogue.id },
        data: {
          last_message_preview: input.body.slice(0, 120),
          last_message_at: m.created_at,
        },
      })
      return m
    })

    return NextResponse.json({ message })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid request' },
        { status: 400 },
      )
    }
    console.error('marketplace message post error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to post message' },
      { status: 500 },
    )
  }
}
