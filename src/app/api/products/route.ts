import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// GET /api/products - List all products
export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('category')
    const search = searchParams.get('search')
    const lowStock = searchParams.get('lowStock') === 'true'
    
    const products = await prisma.product.findMany({
      where: {
        user_id: userId,
        active: true,
        ...(categoryId && { category_id: categoryId }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
            { barcode: { contains: search, mode: 'insensitive' } },
          ]
        }),
        ...(lowStock && {
          quantity: { lte: prisma.product.fields.min_quantity }
        })
      },
      include: {
        product_categories: true,
        _count: {
          select: { stock_movements: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    // For low stock filter, do it in JS since Prisma doesn't support comparing columns directly
    const filteredProducts = lowStock 
      ? products.filter(p => p.quantity <= p.min_quantity)
      : products

    return NextResponse.json(filteredProducts)
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

// POST /api/products - Create a new product
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()

    const quantity = parseInt(body.quantity) || 0
    const minQuantity = parseInt(body.min_quantity) || 0
    const purchasePrice = body.purchase_price ? parseFloat(body.purchase_price) : null
    const sellingPrice = parseFloat(body.selling_price) || 0

    const product = await prisma.product.create({
      data: {
        user_id: userId,
        name: body.name,
        description: body.description || null,
        sku: body.sku || null,
        barcode: body.barcode || null,
        category_id: body.category_id || null,
        purchase_price: purchasePrice,
        selling_price: sellingPrice,
        quantity: quantity,
        min_quantity: minQuantity,
        unit: body.unit || 'pièce',
        location: body.location || null,
        supplier: body.supplier || null,
        image_url: body.image_url || null,
      },
      include: { product_categories: true }
    })

    // Create initial stock movement if quantity > 0
    if (quantity > 0) {
      await prisma.stockMovement.create({
        data: {
          user_id: userId,
          product_id: product.id,
          type: 'initial',
          quantity: quantity,
          unit_price: purchasePrice,
          notes: 'Stock initial'
        }
      })
    }

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
