import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import WMSPageClient from './WMSPageClient'

export const dynamic = 'force-dynamic'

export default async function WMSPage() {
  const userId = await getCurrentUserId()

  // Fetch initial data with error handling
  try {
    const [zones, bins, pickingLists, products] = await Promise.all([
      prisma.warehouseZone.findMany({
        where: { user_id: userId, active: true },
        include: {
          bins: { where: { active: true } },
          _count: { select: { bins: true } }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.warehouseBin.findMany({
        where: { user_id: userId, active: true },
        include: {
          zone: true,
          bin_contents: true,
          _count: { select: { bin_contents: true } }
        },
        orderBy: [{ zone: { name: 'asc' } }, { code: 'asc' }]
      }),
      prisma.pickingList.findMany({
        where: { 
          user_id: userId,
          status: { in: ['pending', 'in_progress'] }
        },
        include: {
          picking_tasks: true,
          _count: { select: { picking_tasks: true } }
        },
        orderBy: [{ priority: 'desc' }, { created_at: 'desc' }],
        take: 10
      }),
      prisma.product.findMany({
        where: { user_id: userId, active: true },
        select: { id: true, name: true, sku: true, quantity: true },
        orderBy: { name: 'asc' }
      })
    ])

    // Calculate stats
    const stats = {
      totalZones: zones.length,
      totalBins: bins.length,
      activePicking: pickingLists.filter(p => p.status === 'in_progress').length,
      pendingPicking: pickingLists.filter(p => p.status === 'pending').length,
    }

    return (
      <WMSPageClient
        zones={zones as unknown as Parameters<typeof WMSPageClient>[0]['zones']}
        bins={bins as unknown as Parameters<typeof WMSPageClient>[0]['bins']}
        pickingLists={pickingLists as unknown as Parameters<typeof WMSPageClient>[0]['pickingLists']}
        products={products}
        stats={stats}
      />
    )
  } catch (error) {
    console.error('Error loading WMS data:', error)
    // Return empty state
    return (
      <WMSPageClient
        zones={[]}
        bins={[]}
        pickingLists={[]}
        products={[]}
        stats={{ totalZones: 0, totalBins: 0, activePicking: 0, pendingPicking: 0 }}
      />
    )
  }
}
