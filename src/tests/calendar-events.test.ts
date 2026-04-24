import { describe, expect, it } from 'vitest'

import {
  canDeleteCalendarEvent,
  getCalendarEventDeleteTarget,
  normalizeCalendarDisplayEvent,
} from '@/lib/calendar-events'

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

  it('translates legacy French calendar records before display', () => {
    expect(
      normalizeCalendarDisplayEvent({
        title: "Soldes d'hiver",
        kind: 'commerce',
        zone: 'France / e-commerce',
        notes: 'PrÃ©parer promotions, stocks, pricing, SAV et capacitÃ© logistique sur 4 semaines.',
      })
    ).toMatchObject({
      title: 'Winter sales',
      kind: 'peak',
      zone: 'France / e-commerce',
      notes: 'Prepare promotions, stock, pricing, customer support and logistics capacity over 4 weeks.',
    })
  })

  it('keeps user leave records in English even when older records were French', () => {
    expect(
      normalizeCalendarDisplayEvent({
        title: 'Vacances Marie',
        kind: 'leave',
        zone: '',
        notes: 'CongÃ©s de Marie du 2026-06-10 au 2026-06-15.',
      })
    ).toMatchObject({
      title: 'Marie vacation',
      kind: 'leave',
      notes: 'Marie time off from 2026-06-10 to 2026-06-15.',
    })
  })
})
