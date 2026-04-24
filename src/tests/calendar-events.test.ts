import { describe, expect, it } from 'vitest'

import { canDeleteCalendarEvent, getCalendarEventDeleteTarget } from '@/lib/calendar-events'

describe('calendar event deletion helpers', () => {
  it('prefers the detail event over the selected event when deleting from the modal', () => {
    const selectedEvent = { id: 'selected-event', kind: 'peak', locked: false }
    const detailEvent = { id: 'detail-event', kind: 'leave', locked: false }

    expect(getCalendarEventDeleteTarget(detailEvent, selectedEvent)).toEqual(detailEvent)
  })

  it('allows user-created leave events to be deleted', () => {
    expect(canDeleteCalendarEvent({ id: 'leave-1', kind: 'leave', locked: false })).toBe(true)
  })

  it('keeps locked calendar events protected', () => {
    expect(canDeleteCalendarEvent({ id: 'holiday-1', kind: 'holiday', locked: true })).toBe(false)
  })
})
