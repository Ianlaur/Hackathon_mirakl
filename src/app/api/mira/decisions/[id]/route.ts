import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { resolveDecisionMutation } from '@/lib/mira/decisionMutations'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  action: z.enum(['approve', 'reject', 'override']),
  reason: z.string().max(800).optional(),
})

const paramsSchema = z.object({
  id: z.string().uuid(),
})

const decisionSelect = {
  id: true,
  sku: true,
  channel: true,
  action_type: true,
  template_id: true,
  logical_inference: true,
  raw_payload: true,
  status: true,
  reversible: true,
  source_agent: true,
  triggered_by: true,
  created_at: true,
  executed_at: true,
  founder_decision_at: true,
} as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = paramsSchema.parse(params)
    const { action, reason } = patchSchema.parse(await request.json())

    const current = await prisma.decisionRecord.findFirst({
      where: { id, user_id: userId },
      select: { id: true, status: true },
    })

    if (!current) {
      return NextResponse.json({ error: 'Decision not found' }, { status: 404 })
    }

    let mutation: ReturnType<typeof resolveDecisionMutation>
    try {
      mutation = resolveDecisionMutation({
        action,
        reason,
        currentStatus: current.status,
      })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Decision action is not allowed' },
        { status: 409 },
      )
    }

    const decision = await prisma.$transaction(async (tx) => {
      const updated = await tx.decisionRecord.update({
        where: { id: current.id },
        data: mutation.decisionData,
        select: decisionSelect,
      })

      if (mutation.overrideRecord) {
        await tx.overrideRecord.create({
          data: {
            user_id: userId,
            decision_id: current.id,
            previous_status: mutation.overrideRecord.previous_status,
            reason: mutation.overrideRecord.reason,
          },
        })
      }

      return updated
    })

    return NextResponse.json({ decision })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid request' },
        { status: 400 },
      )
    }

    console.error('MIRA decision mutation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update decision' },
      { status: 500 },
    )
  }
}
