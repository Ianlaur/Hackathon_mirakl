import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// GET /api/products/[id] - Get a single product
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId()
    
    const product = await prisma.product.findFirst({
      where: {
        id: params.id,
        user_id: userId
      },
      include: {
        product_categories: true,
        stock_movements: {
          orderBy: { created_at: 'desc' },
          take: 50
        }
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

// PATCH /api/products/[id] - Update a product
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()

    // Verify ownership
    const existing = await prisma.product.findFirst({
      where: { id: params.id, user_id: userId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        name: body.name,
        description: body.description,
        sku: body.sku,
        barcode: body.barcode,
        category_id: body.category_id || null,
        purchase_price: body.purchase_price ? parseFloat(body.purchase_price) : null,
        selling_price: body.selling_price ? parseFloat(body.selling_price) : undefined,
        min_quantity: body.min_quantity,
        unit: body.unit,
        location: body.location,
        supplier: body.supplier,
        image_url: body.image_url,
        active: body.active,
      },
      include: { product_categories: true }
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

// DELETE /api/products/[id] - Soft delete a product
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getCurrentUserId()

    // Verify ownership
    const existing = await prisma.product.findFirst({
      where: { id: params.id, user_id: userId }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Soft delete by setting active to false
    await prisma.product.update({
      where: { id: params.id },
      data: { active: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
