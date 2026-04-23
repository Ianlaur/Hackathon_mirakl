import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import ActivityPageClient, { type LedgerRow } from './ActivityPageClient'

export const dynamic = 'force-dynamic'

export default async function ActivityPage() {
  const userId = await getCurrentUserId()

  let decisions: LedgerRow[] = []
  try {
    const rows = await prisma.decisionRecord.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 200,
      select: {
        id: true,
        sku: true,
        channel: true,
        action_type: true,
        template_id: true,
        logical_inference: true,
        status: true,
        reversible: true,
        source_agent: true,
        triggered_by: true,
        trigger_event_id: true,
        created_at: true,
        executed_at: true,
        founder_decision_at: true,
      },
    })
    decisions = rows.map((d) => ({
      ...d,
      created_at: d.created_at.toISOString(),
      executed_at: d.executed_at?.toISOString() ?? null,
      founder_decision_at: d.founder_decision_at?.toISOString() ?? null,
    }))
  } catch (error) {
    console.error('Error loading activity ledger:', error)
  }

  return <ActivityPageClient initial={decisions} />
}
