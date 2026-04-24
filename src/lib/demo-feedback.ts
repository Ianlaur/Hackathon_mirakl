export function getCalendarSyncNotice(
  action: 'created' | 'updated' | 'deleted',
  title: string
) {
  const cleanTitle = title.trim() || 'Event'

  if (action === 'created') return `${cleanTitle} added to calendar.`
  if (action === 'deleted') return `${cleanTitle} removed from calendar.`
  return `${cleanTitle} updated in calendar.`
}

export function getRecommendationSyncNotice(
  action: 'approve' | 'reject',
  title: string
) {
  const cleanTitle = title.trim() || 'This recommendation'
  return `Leia ${action === 'approve' ? 'approved' : 'rejected'} "${cleanTitle}".`
}
