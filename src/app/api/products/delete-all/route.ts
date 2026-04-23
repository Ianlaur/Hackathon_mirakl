import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // First delete all stock movements (due to foreign key constraint)
    await prisma.stockMovement.deleteMany({
      where: {
        products: {
          user_id: user.id
        }
      }
    })

    // Then delete all products
    const productsResult = await prisma.product.deleteMany({
      where: {
        user_id: user.id
      }
    })

    // Also delete all categories
    const categoriesResult = await prisma.productCategory.deleteMany({
      where: {
        user_id: user.id
      }
    })

    return NextResponse.json({ 
      success: true, 
      deleted: productsResult.count,
      categoriesDeleted: categoriesResult.count,
      message: `${productsResult.count} product(s) and ${categoriesResult.count} categor${categoriesResult.count === 1 ? 'y' : 'ies'} deleted`
    })
  } catch (error) {
    console.error('Error deleting all products:', error)
    return NextResponse.json(
      { error: 'Deletion failed' },
      { status: 500 }
    )
  }
}
