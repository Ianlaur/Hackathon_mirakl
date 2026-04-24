import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// GET /api/product-categories - List all categories
export async function GET() {
  try {
    const userId = await getCurrentUserId()
    
    const categories = await prisma.productCategory.findMany({
      where: { user_id: userId },
      include: {
        _count: {
          select: { products: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

// POST /api/product-categories - Create a new category
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()

    const category = await prisma.productCategory.create({
      data: {
        user_id: userId,
        name: body.name,
        description: body.description || null,
        color: body.color || '#6366f1',
        icon: body.icon || null,
      }
    })

    return NextResponse.json(category, { status: 201 })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 400 }
      )
    }
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
  }
}
