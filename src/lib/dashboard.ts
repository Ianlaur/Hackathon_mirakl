export type DashboardRecommendation = {
  id: string
  title: string
  scenario_type: string
  status: string
  reasoning_summary: string
  created_at: string
}

export function selectDashboardRecommendations(
  recommendations: DashboardRecommendation[],
  limit = 2
) {
  return recommendations
    .filter((recommendation) => recommendation.status === 'pending_approval')
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    )
    .slice(0, limit)
}

export function getDashboardPrimaryActionLabel(scenarioType: string) {
  return scenarioType.includes('price') ? 'Apply Price Change' : 'Approve Restock'
}

export function getDashboardSecondaryActionLabel(scenarioType: string) {
  return scenarioType.includes('price') ? 'Review Details' : 'Ignore'
}

export function buildDashboardHistoryMessage(
  recommendation: Pick<DashboardRecommendation, 'title' | 'scenario_type'>,
  action: 'approve' | 'reject'
) {
  const actionLabel = action === 'approve' ? 'approved' : 'rejected'
  const scenarioLabel = recommendation.scenario_type.replaceAll('_', ' ')

  return {
    content: `Leia marked "${recommendation.title}" as ${actionLabel}.`,
    reasoningSummary: `History updated | ${scenarioLabel} | ${actionLabel}`,
  }
}
