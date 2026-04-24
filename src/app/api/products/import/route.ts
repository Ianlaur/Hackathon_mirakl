import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// POST /api/products/import - Bulk import products
export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    const { products } = body

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'No products to import' }, { status: 400 })
    }

    // Get user's categories for mapping
    const existingCategories = await prisma.productCategory.findMany({
      where: { user_id: userId }
    })
    const categoryMap = new Map(existingCategories.map(c => [c.name.toLowerCase(), c.id]))

    let imported = 0
    let failed = 0
    const errors: string[] = []

    for (const product of products) {
      try {
        if (!product.name) {
          failed++
          errors.push(`Product missing name`)
          continue
        }

        // Handle category - create if doesn't exist
        let categoryId: string | null = null
        if (product.category) {
          const categoryName = product.category.toLowerCase()
          if (categoryMap.has(categoryName)) {
            categoryId = categoryMap.get(categoryName)!
          } else {
            // Create new category
            const newCategory = await prisma.productCategory.create({
              data: {
                user_id: userId,
                name: product.category,
                color: '#6366f1'
              }
            })
            categoryMap.set(categoryName, newCategory.id)
            categoryId = newCategory.id
          }
        }

        const quantity = parseInt(product.quantity) || 0
        const purchasePrice = product.purchase_price ? parseFloat(product.purchase_price) : null

        // Create product
        const newProduct = await prisma.product.create({
          data: {
            user_id: userId,
            name: product.name,
            sku: product.sku || null,
            barcode: product.barcode || null,
            description: product.description || null,
            category_id: categoryId,
            purchase_price: purchasePrice,
            selling_price: parseFloat(product.selling_price) || 0,
            quantity: quantity,
            min_quantity: parseInt(product.min_quantity) || 0,
            unit: product.unit || 'piece',
            location: product.location || null,
            supplier: product.supplier || null,
          }
        })

        // Create initial stock movement if quantity > 0
        if (quantity > 0) {
          await prisma.stockMovement.create({
            data: {
              user_id: userId,
              product_id: newProduct.id,
              type: 'initial',
              quantity: quantity,
              unit_price: purchasePrice,
              notes: 'Import initial'
            }
          })
        }

        imported++
      } catch (error) {
        failed++
        errors.push(`Failed to import "${product.name}": ${error}`)
        console.error(`Error importing product:`, error)
      }
    }

    return NextResponse.json({
      imported,
      failed,
      total: products.length,
      errors: errors.slice(0, 10) // Only return first 10 errors
    })
  } catch (error) {
    console.error('Error importing products:', error)
    return NextResponse.json({ error: 'Failed to import products' }, { status: 500 })
  }
}
