import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import StockPageClient from './StockPageClient'

export const dynamic = 'force-dynamic'

export default async function StockPage() {
  const userId = await getCurrentUserId()

  try {
    const [products, categories, recentMovements] = await Promise.all([
      prisma.product.findMany({
        where: { user_id: userId, active: true },
        include: {
          product_categories: true,
          _count: { select: { stock_movements: true } }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.productCategory.findMany({
        where: { user_id: userId },
        include: { _count: { select: { products: true } } },
        orderBy: { name: 'asc' }
      }),
      prisma.stockMovement.findMany({
        where: { user_id: userId },
        include: { products: { select: { id: true, name: true, sku: true } } },
        orderBy: { created_at: 'desc' },
        take: 20
      })
    ])

    // Calculate stats
    const totalProducts = products.length
    const totalValue = products.reduce((sum, p) => sum + (Number(p.selling_price) * p.quantity), 0)
    const lowStockCount = products.filter(p => p.quantity <= p.min_quantity).length
    const outOfStockCount = products.filter(p => p.quantity === 0).length

    const stats = {
      totalProducts,
      totalValue,
      lowStockCount,
      outOfStockCount
    }

    // Serialize for client
    const serializedProducts = products.map(p => ({
      ...p,
      purchase_price: p.purchase_price ? Number(p.purchase_price) : null,
      selling_price: Number(p.selling_price),
      created_at: p.created_at.toISOString(),
      updated_at: p.updated_at.toISOString(),
      category: p.product_categories ? {
        ...p.product_categories,
        created_at: p.product_categories.created_at.toISOString(),
        updated_at: p.product_categories.updated_at.toISOString()
      } : null
    }))

    const serializedCategories = categories.map(c => ({
      ...c,
      created_at: c.created_at.toISOString(),
      updated_at: c.updated_at.toISOString()
    }))

    const serializedMovements = recentMovements.map(m => ({
      ...m,
      unit_price: m.unit_price ? Number(m.unit_price) : null,
      created_at: m.created_at.toISOString()
    }))

    return (
      <StockPageClient
        products={serializedProducts}
        categories={serializedCategories}
        recentMovements={serializedMovements}
        stats={stats}
      />
    )
  } catch (error) {
    console.error('Error loading stock data:', error)
    return (
      <StockPageClient
        products={[]}
        categories={[]}
        recentMovements={[]}
        stats={{ totalProducts: 0, totalValue: 0, lowStockCount: 0, outOfStockCount: 0 }}
      />
    )
  }
}
