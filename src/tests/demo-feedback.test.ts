import { describe, expect, it } from 'vitest'

import {
  getCalendarSyncNotice,
  getRecommendationSyncNotice,
} from '@/lib/demo-feedback'

describe('demo feedback copy', () => {
  it('formats the calendar creation notice', () => {
    expect(getCalendarSyncNotice('created', 'Summer leave')).toBe(
      'Summer leave added to calendar.'
    )
  })

  it('formats the calendar deletion notice', () => {
    expect(getCalendarSyncNotice('deleted', 'Summer leave')).toBe(
      'Summer leave removed from calendar.'
    )
  })

  it('formats the calendar update notice', () => {
    expect(getCalendarSyncNotice('updated', 'Summer leave')).toBe(
      'Summer leave updated in calendar.'
    )
  })

  it('formats the recommendation approval notice', () => {
    expect(getRecommendationSyncNotice('approve', 'Restock low stock items')).toBe(
      'Leia approved "Restock low stock items".'
    )
  })

  it('formats the recommendation rejection notice', () => {
    expect(getRecommendationSyncNotice('reject', 'Pause Google DE')).toBe(
      'Leia rejected "Pause Google DE".'
    )
  })
})
