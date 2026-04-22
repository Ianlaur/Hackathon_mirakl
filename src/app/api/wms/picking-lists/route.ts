import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

const pickingListSchema = z.object({
  reference: z.string().optional(),
  priority: z.number().int().min(0).max(10).default(0),
  notes: z.string().optional().nullable(),
  assigned_to: z.string().optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().positive(),
    source_bin_id: z.string().uuid().optional().nullable(),
  })).min(1, 'Au moins un article requis')
})

// GET - List picking lists
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const pickingLists = await prisma.pickingList.findMany({
      where: { 
        user_id: userId,
        ...(status ? { status: status as 'pending' | 'in_progress' | 'completed' | 'cancelled' } : {})
      },
      include: {
        picking_tasks: {
          include: {
            source_bin: { include: { zone: true } }
          }
        },
        _count: { select: { picking_tasks: true } }
      },
      orderBy: [{ priority: 'desc' }, { created_at: 'desc' }]
    })

    return NextResponse.json(pickingLists)
  } catch (error) {
    console.error('Error fetching picking lists:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST - Create a new picking list
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    
    const parsed = pickingListSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Données invalides' },
        { status: 400 }
      )
    }

    // Generate reference if not provided
    const reference = parsed.data.reference || `PICK-${Date.now().toString(36).toUpperCase()}`

    // Create picking list with tasks
    const pickingList = await prisma.pickingList.create({
      data: {
        user_id: userId,
        reference,
        priority: parsed.data.priority,
        notes: parsed.data.notes,
        assigned_to: parsed.data.assigned_to,
        picking_tasks: {
          create: parsed.data.items.map(item => ({
            user_id: userId,
            product_id: item.product_id,
            source_bin_id: item.source_bin_id,
            quantity_ordered: item.quantity,
          }))
        }
      },
      include: {
        picking_tasks: {
          include: {
            source_bin: { include: { zone: true } }
          }
        }
      }
    })

    return NextResponse.json(pickingList, { status: 201 })
  } catch (error) {
    console.error('Error creating picking list:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
