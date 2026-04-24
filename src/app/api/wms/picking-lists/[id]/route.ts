import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

const updatePickingListSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).optional(),
  priority: z.number().int().min(0).max(10).optional(),
  notes: z.string().optional().nullable(),
  assigned_to: z.string().optional().nullable(),
})

// GET - Get a single picking list
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params

    const pickingList = await prisma.pickingList.findFirst({
      where: { id, user_id: userId },
      include: {
        picking_tasks: {
          include: {
            source_bin: { include: { zone: true } }
          },
          orderBy: { created_at: 'asc' }
        }
      }
    })

    if (!pickingList) {
      return NextResponse.json({ error: 'Picking list not found' }, { status: 404 })
    }

    return NextResponse.json(pickingList)
  } catch (error) {
    console.error('Error fetching picking list:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH - Update a picking list
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params
    const body = await request.json()

    const parsed = updatePickingListSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid data' },
        { status: 400 }
      )
    }

    // Verify ownership
    const existing = await prisma.pickingList.findFirst({
      where: { id, user_id: userId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Picking list not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = { ...parsed.data }

    // Set timestamps based on status changes
    if (parsed.data.status === 'in_progress' && existing.status === 'pending') {
      updateData.started_at = new Date()
    }
    if (parsed.data.status === 'completed' && existing.status !== 'completed') {
      updateData.completed_at = new Date()
    }

    const pickingList = await prisma.pickingList.update({
      where: { id },
      data: updateData,
      include: {
        picking_tasks: true,
        _count: { select: { picking_tasks: true } }
      }
    })

    return NextResponse.json(pickingList)
  } catch (error) {
    console.error('Error updating picking list:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE - Cancel a picking list
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params

    const existing = await prisma.pickingList.findFirst({
      where: { id, user_id: userId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Picking list not found' }, { status: 404 })
    }

    if (existing.status === 'completed') {
      return NextResponse.json(
        { error: 'Unable to delete a completed list' },
        { status: 400 }
      )
    }

    await prisma.$transaction([
      prisma.pickingTask.updateMany({
        where: { picking_list_id: id },
        data: { status: 'cancelled' }
      }),
      prisma.pickingList.update({
        where: { id },
        data: { status: 'cancelled' }
      })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting picking list:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
