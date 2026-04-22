import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// POST /api/product-categories/delete-empty - Delete all empty categories
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()

    // Find all categories with 0 products
    const emptyCategories = await prisma.productCategory.findMany({
      where: {
        user_id: userId,
        products: {
          none: {}
        }
      }
    })

    if (emptyCategories.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: 'Aucune catégorie vide à supprimer'
      })
    }

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
  } catch (error) {
    console.error('Error deleting empty categories:', error)
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    )
  }
}
