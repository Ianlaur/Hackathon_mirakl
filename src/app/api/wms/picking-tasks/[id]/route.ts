import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

const updateTaskSchema = z.object({
  quantity_picked: z.number().int().min(0).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  source_bin_id: z.string().uuid().optional().nullable(),
})

// PATCH - Update a picking task (pick items)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params
    const body = await request.json()

    const parsed = updateTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid data' },
        { status: 400 }
      )
    }

    // Verify ownership
    const existing = await prisma.pickingTask.findFirst({
      where: { id, user_id: userId },
      include: { picking_list: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = { ...parsed.data }

    // Auto-complete task when quantity matches
    if (parsed.data.quantity_picked !== undefined) {
      if (parsed.data.quantity_picked >= existing.quantity_ordered) {
        updateData.status = 'completed'
        updateData.picked_at = new Date()
      } else if (parsed.data.quantity_picked > 0) {
        updateData.status = 'in_progress'
      }
    }

    const task = await prisma.pickingTask.update({
      where: { id },
      data: updateData,
      include: {
        source_bin: { include: { zone: true } },
        picking_list: true
      }
    })

    // Check if all tasks in the list are completed
    if (task.status === 'completed') {
      const pendingTasks = await prisma.pickingTask.count({
        where: {
          picking_list_id: existing.picking_list_id,
          status: { not: 'completed' }
        }
      })

      if (pendingTasks === 0) {
        await prisma.pickingList.update({
          where: { id: existing.picking_list_id },
          data: { status: 'completed', completed_at: new Date() }
        })
      }
    }

    return NextResponse.json(task)
  } catch (error) {
    console.error('Error updating picking task:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
