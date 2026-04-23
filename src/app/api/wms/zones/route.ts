import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

const zoneSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  code: z.string().min(1, 'Le code est requis').max(20),
  description: z.string().optional().nullable(),
  zone_type: z.enum(['receiving', 'storage', 'picking', 'shipping', 'returns', 'quarantine']).default('storage'),
  color: z.string().optional().nullable(),
})

// GET - List all warehouse zones
export async function GET() {
  try {
    const userId = await getCurrentUserId()
    
    const zones = await prisma.warehouseZone.findMany({
      where: { user_id: userId, active: true },
      include: {
        bins: {
          where: { active: true },
          include: {
            _count: { select: { bin_contents: true } }
          }
        },
        _count: { select: { bins: true } }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(zones)
  } catch (error) {
    console.error('Error fetching zones:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST - Create a new zone
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    
    const parsed = zoneSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Données invalides' },
        { status: 400 }
      )
    }

    // Check if code already exists
    const existing = await prisma.warehouseZone.findUnique({
      where: { user_id_code: { user_id: userId, code: parsed.data.code } }
    })
    
    if (existing) {
      return NextResponse.json({ error: 'Ce code de zone existe déjà' }, { status: 400 })
    }

    const zone = await prisma.warehouseZone.create({
      data: {
        user_id: userId,
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
        description: parsed.data.description,
        zone_type: parsed.data.zone_type,
        color: parsed.data.color || '#6366f1',
      },
      include: {
        _count: { select: { bins: true } }
      }
    })

    return NextResponse.json(zone, { status: 201 })
  } catch (error) {
    console.error('Error creating zone:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
