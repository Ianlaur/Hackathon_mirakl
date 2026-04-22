import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import ActionsPageClient from './ActionsPageClient'
import type { RecommendationDTO } from './types'

export const dynamic = 'force-dynamic'

export default async function ActionsPage() {
  const userId = await getCurrentUserId()

  const recommendations = await prisma.agentRecommendation.findMany({
    where: { user_id: userId },
    orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
    take: 50,
  })

  const serialized: RecommendationDTO[] = recommendations.map((r) => ({
    id: r.id,
    title: r.title,
    scenario_type: r.scenario_type,
    status: r.status,
    reasoning_summary: r.reasoning_summary,
    expected_impact: r.expected_impact,
    confidence_note: r.confidence_note,
    evidence_payload: (r.evidence_payload as any) ?? null,
    action_payload: (r.action_payload as any) ?? null,
    approval_required: r.approval_required,
    source: r.source,
    created_at: r.created_at.toISOString(),
    updated_at: r.updated_at.toISOString(),
  }))

  return <ActionsPageClient initialRecommendations={serialized} />
}
