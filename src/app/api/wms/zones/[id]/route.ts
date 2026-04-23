import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

const updateZoneSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).max(20).optional(),
  description: z.string().optional().nullable(),
  zone_type: z.enum(['receiving', 'storage', 'picking', 'shipping', 'returns', 'quarantine']).optional(),
  color: z.string().optional().nullable(),
  active: z.boolean().optional(),
})

// GET - Get a single zone
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params

    const zone = await prisma.warehouseZone.findFirst({
      where: { id, user_id: userId },
      include: {
        bins: {
          where: { active: true },
          include: {
            bin_contents: true,
            _count: { select: { bin_contents: true, picking_tasks: true } }
          },
          orderBy: { code: 'asc' }
        }
      }
    })

    if (!zone) {
      return NextResponse.json({ error: 'Zone non trouvée' }, { status: 404 })
    }

    return NextResponse.json(zone)
  } catch (error) {
    console.error('Error fetching zone:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// PATCH - Update a zone
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params
    const body = await request.json()

    const parsed = updateZoneSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Données invalides' },
        { status: 400 }
      )
    }

    // Verify ownership
    const existing = await prisma.warehouseZone.findFirst({
      where: { id, user_id: userId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Zone non trouvée' }, { status: 404 })
    }

    // Check code uniqueness if updating code
    if (parsed.data.code && parsed.data.code !== existing.code) {
      const codeExists = await prisma.warehouseZone.findUnique({
        where: { user_id_code: { user_id: userId, code: parsed.data.code } }
      })
      if (codeExists) {
        return NextResponse.json({ error: 'Ce code de zone existe déjà' }, { status: 400 })
      }
    }

    const zone = await prisma.warehouseZone.update({
      where: { id },
      data: {
        ...parsed.data,
        code: parsed.data.code?.toUpperCase()
      },
      include: {
        _count: { select: { bins: true } }
      }
    })

    return NextResponse.json(zone)
  } catch (error) {
    console.error('Error updating zone:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE - Soft delete a zone
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params

    const existing = await prisma.warehouseZone.findFirst({
      where: { id, user_id: userId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Zone non trouvée' }, { status: 404 })
    }

    // Soft delete zone and all bins
    await prisma.$transaction([
      prisma.warehouseBin.updateMany({
        where: { zone_id: id },
        data: { active: false }
      }),
      prisma.warehouseZone.update({
        where: { id },
        data: { active: false }
      })
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting zone:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
