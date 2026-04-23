import { NextResponse } from 'next/server'
import { getCurrentUserId } from '@/lib/session'
import { getRecentLowStockAlerts, processPendingLowStockAlerts } from '@/lib/lowStockAutomation'
import { hasDatabaseUrl, isDatabaseConfigError } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json({ alerts: [] })
    }

    const userId = await getCurrentUserId()
    await processPendingLowStockAlerts(userId, 3)
    const alerts = await getRecentLowStockAlerts(userId, 6)
    return NextResponse.json({ alerts })
  } catch (error) {
    if (isDatabaseConfigError(error)) {
      return NextResponse.json({ alerts: [] })
    }

    console.error('Error loading low-stock alerts:', error)
    return NextResponse.json({ error: 'Failed to load low-stock alerts' }, { status: 500 })
  }
}
