import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// POST /api/products/[id]/stock - Add stock movement
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()

    // Verify product ownership
    const product = await prisma.product.findFirst({
      where: { id: params.id, user_id: userId }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Determine quantity change based on movement type
    let quantityChange = Math.abs(body.quantity)
    const outgoingTypes = ['sale', 'return_out', 'loss', 'transfer']
    
    if (outgoingTypes.includes(body.type)) {
      quantityChange = -quantityChange
    }

    // Check if we have enough stock for outgoing movements
    if (quantityChange < 0 && product.quantity + quantityChange < 0) {
      return NextResponse.json(
        { error: 'Stock insuffisant pour cette opération' },
        { status: 400 }
      )
    }

    // Create movement and update product quantity in a transaction
    const [movement, updatedProduct] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          user_id: userId,
          product_id: params.id,
          type: body.type,
          quantity: quantityChange,
          unit_price: body.unit_price ? parseFloat(body.unit_price) : null,
          reference: body.reference || null,
          notes: body.notes || null,
        }
      }),
      prisma.product.update({
        where: { id: params.id },
        data: {
          quantity: { increment: quantityChange }
        },
        include: { product_categories: true }
      })
    ])

    return NextResponse.json({ movement, product: updatedProduct }, { status: 201 })
  } catch (error) {
    console.error('Error creating stock movement:', error)
    return NextResponse.json({ error: 'Failed to create stock movement' }, { status: 500 })
  }
}

// GET /api/products/[id]/stock - Get stock movements for a product
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId()

    const movements = await prisma.stockMovement.findMany({
      where: {
        product_id: params.id,
        user_id: userId
      },
      orderBy: { created_at: 'desc' },
      take: 100
    })

    return NextResponse.json(movements)
  } catch (error) {
    console.error('Error fetching stock movements:', error)
    return NextResponse.json({ error: 'Failed to fetch movements' }, { status: 500 })
  }
}
