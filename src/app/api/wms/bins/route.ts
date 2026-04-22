import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

const binSchema = z.object({
  zone_id: z.string().uuid('ID de zone invalide'),
  name: z.string().min(1, 'Le nom est requis'),
  code: z.string().min(1, 'Le code est requis').max(30),
  barcode: z.string().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
})

// GET - List all bins
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const { searchParams } = new URL(request.url)
    const zoneId = searchParams.get('zone_id')

    const bins = await prisma.warehouseBin.findMany({
      where: { 
        user_id: userId, 
        active: true,
        ...(zoneId ? { zone_id: zoneId } : {})
      },
      include: {
        zone: true,
        bin_contents: true,
        _count: { select: { bin_contents: true, picking_tasks: true } }
      },
      orderBy: [{ zone: { name: 'asc' } }, { code: 'asc' }]
    })

    return NextResponse.json(bins)
  } catch (error) {
    console.error('Error fetching bins:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create a new bin
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    
    const parsed = binSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Données invalides' },
        { status: 400 }
      )
    }

    // Verify zone ownership
    const zone = await prisma.warehouseZone.findFirst({
      where: { id: parsed.data.zone_id, user_id: userId }
    })

    if (!zone) {
      return NextResponse.json({ error: 'Zone non trouvée' }, { status: 404 })
    }

    // Check if code already exists
    const existing = await prisma.warehouseBin.findUnique({
      where: { user_id_code: { user_id: userId, code: parsed.data.code } }
    })
    
    if (existing) {
      return NextResponse.json({ error: 'Ce code d\'emplacement existe déjà' }, { status: 400 })
    }

    const bin = await prisma.warehouseBin.create({
      data: {
        user_id: userId,
        zone_id: parsed.data.zone_id,
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        barcode: parsed.data.barcode,
        capacity: parsed.data.capacity,
      },
      include: {
        zone: true,
        _count: { select: { bin_contents: true } }
      }
    })

    return NextResponse.json(bin, { status: 201 })
  } catch (error) {
    console.error('Error creating bin:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
