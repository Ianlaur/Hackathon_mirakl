import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { z } from 'zod'

// GET - List all bin contents (product locations)
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const binId = searchParams.get('binId')

    const where: any = { user_id: userId }
    if (productId) where.product_id = productId
    if (binId) where.bin_id = binId

    const binContents = await prisma.binContent.findMany({
      where,
      include: {
        bin: {
          include: {
            zone: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            quantity: true,
            unit: true
          }
        }
      },
      orderBy: [
        { bin: { zone: { name: 'asc' } } },
        { bin: { code: 'asc' } }
      ]
    })

    return NextResponse.json(binContents)
  } catch (error) {
    console.error('Error fetching bin contents:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

const createSchema = z.object({
  bin_id: z.string().uuid('ID emplacement invalide'),
  product_id: z.string().uuid('ID produit invalide'),
  quantity: z.number().int().min(0, 'La quantité doit être positive')
})

// POST - Add or update product in bin
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    const data = createSchema.parse(body)

    // Verify bin belongs to user
    const bin = await prisma.warehouseBin.findFirst({
      where: { id: data.bin_id, user_id: userId }
    })
    if (!bin) {
      return NextResponse.json({ error: 'Emplacement introuvable' }, { status: 404 })
    }

    // Verify product belongs to user
    const product = await prisma.product.findFirst({
      where: { id: data.product_id, user_id: userId }
    })
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Upsert bin content (create or update)
    const binContent = await prisma.binContent.upsert({
      where: {
        bin_id_product_id: {
          bin_id: data.bin_id,
          product_id: data.product_id
        }
      },
      update: {
        quantity: data.quantity,
        updated_at: new Date()
      },
      create: {
        user_id: userId,
        bin_id: data.bin_id,
        product_id: data.product_id,
        quantity: data.quantity
      },
      include: {
        bin: { include: { zone: true } },
        product: { select: { id: true, name: true, sku: true, unit: true } }
      }
    })

    return NextResponse.json(binContent, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }
    console.error('Error creating bin content:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// DELETE - Remove product from bin
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const { searchParams } = new URL(request.url)
    const binId = searchParams.get('binId')
    const productId = searchParams.get('productId')

    if (!binId || !productId) {
      return NextResponse.json({ error: 'binId et productId requis' }, { status: 400 })
    }

    // Verify ownership
    const binContent = await prisma.binContent.findFirst({
      where: {
        bin_id: binId,
        product_id: productId,
        user_id: userId
      }
    })

    if (!binContent) {
      return NextResponse.json({ error: 'Contenu introuvable' }, { status: 404 })
    }

    await prisma.binContent.delete({
      where: { id: binContent.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting bin content:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
