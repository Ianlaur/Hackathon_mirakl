import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// DELETE /api/product-categories/[id] - Delete a category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params

    // First check if category exists and belongs to user
    const category = await prisma.productCategory.findFirst({
      where: {
        id,
        user_id: userId
      },
      include: {
        _count: {
          select: { products: true }
        }
      }
    })

    if (!category) {
      return NextResponse.json(
        { error: 'Catégorie non trouvée' },
        { status: 404 }
      )
    }

    // Check if category has products
    if (category._count.products > 0) {
      return NextResponse.json(
        { error: `Cette catégorie contient ${category._count.products} produit(s). Supprimez d'abord les produits.` },
        { status: 400 }
      )
    }

    // Delete the category
    await prisma.productCategory.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    )
  }
}

// DELETE all empty categories
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId()
    const { id } = await params

    // Special route to delete all empty categories
    if (id === 'delete-empty') {
      // Find all categories with 0 products
      const emptyCategories = await prisma.productCategory.findMany({
        where: {
          user_id: userId,
          products: {
            none: {}
          }
        }
      })

      const result = await prisma.productCategory.deleteMany({
        where: {
          id: {
            in: emptyCategories.map(c => c.id)
          }
        }
      })

      return NextResponse.json({
        success: true,
        deleted: result.count,
        message: `${result.count} catégorie(s) vide(s) supprimée(s)`
      })
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    )
  }
}
