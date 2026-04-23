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
  return [...recommendations]
    .sort((left, right) => {
      const leftPending = left.status === 'pending_approval' ? 1 : 0
      const rightPending = right.status === 'pending_approval' ? 1 : 0

      if (leftPending !== rightPending) {
        return rightPending - leftPending
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    })
    .slice(0, limit)
}

export function getDashboardPrimaryActionLabel(scenarioType: string) {
  return scenarioType.includes('price') ? 'Apply Price Change' : 'Approve Restock'
}

export function getDashboardSecondaryActionLabel(scenarioType: string) {
  return scenarioType.includes('price') ? 'Review Details' : 'Ignore'
}
