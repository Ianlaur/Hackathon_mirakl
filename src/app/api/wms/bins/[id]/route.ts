import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

const updateBinSchema = z.object({
  zone_id: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  code: z.string().min(1).max(30).optional(),
  barcode: z.string().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  active: z.boolean().optional(),
})

// GET - Get a single bin with contents
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params

    const bin = await prisma.warehouseBin.findFirst({
      where: { id, user_id: userId },
      include: {
        zone: true,
        bin_contents: true,
        picking_tasks: {
          where: { status: { in: ['pending', 'in_progress'] } },
          orderBy: { created_at: 'desc' }
        }
      }
    })

    if (!bin) {
      return NextResponse.json({ error: 'Emplacement non trouvé' }, { status: 404 })
    }

    return NextResponse.json(bin)
  } catch (error) {
    console.error('Error fetching bin:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH - Update a bin
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params
    const body = await request.json()

    const parsed = updateBinSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Données invalides' },
        { status: 400 }
      )
    }

    // Verify ownership
    const existing = await prisma.warehouseBin.findFirst({
      where: { id, user_id: userId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Emplacement non trouvé' }, { status: 404 })
    }

    // Verify new zone ownership if changing zone
    if (parsed.data.zone_id && parsed.data.zone_id !== existing.zone_id) {
      const zone = await prisma.warehouseZone.findFirst({
        where: { id: parsed.data.zone_id, user_id: userId }
      })
      if (!zone) {
        return NextResponse.json({ error: 'Zone non trouvée' }, { status: 404 })
      }
    }

    // Check code uniqueness if updating code
    if (parsed.data.code && parsed.data.code !== existing.code) {
      const codeExists = await prisma.warehouseBin.findUnique({
        where: { user_id_code: { user_id: userId, code: parsed.data.code } }
      })
      if (codeExists) {
        return NextResponse.json({ error: 'Ce code d\'emplacement existe déjà' }, { status: 400 })
      }
    }

    const bin = await prisma.warehouseBin.update({
      where: { id },
      data: {
        ...parsed.data,
        code: parsed.data.code?.toUpperCase()
      },
      include: {
        zone: true,
        _count: { select: { bin_contents: true } }
      }
    })

    return NextResponse.json(bin)
  } catch (error) {
    console.error('Error updating bin:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE - Soft delete a bin
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params

    const existing = await prisma.warehouseBin.findFirst({
      where: { id, user_id: userId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Emplacement non trouvé' }, { status: 404 })
    }

    // Check for pending picking tasks
    const pendingTasks = await prisma.pickingTask.count({
      where: { source_bin_id: id, status: { in: ['pending', 'in_progress'] } }
    })

    if (pendingTasks > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer: des tâches de picking sont en cours' },
        { status: 400 }
      )
    }

    await prisma.warehouseBin.update({
      where: { id },
      data: { active: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting bin:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
