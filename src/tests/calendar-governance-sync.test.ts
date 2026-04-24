import { describe, expect, it } from 'vitest'

import {
  deriveActiveCalendarAbsence,
  shouldClearExpiredCalendarVacation,
} from '@/lib/leia/calendar-sync'

describe('calendar governance sync', () => {
  it('derives Vacation while a leave calendar event is active', () => {
    const active = deriveActiveCalendarAbsence(
      [
        {
          source: 'calendar_events',
          title: 'Vacation',
          kind: 'leave',
          startAt: new Date('2026-04-23T00:00:00.000Z'),
          endAt: new Date('2026-05-05T23:59:59.000Z'),
        },
      ],
      new Date('2026-04-24T10:00:00.000Z')
    )

    expect(active).toEqual({
      state: 'Vacation',
      until: new Date('2026-05-05T23:59:59.000Z'),
      source: 'calendar_events',
      title: 'Vacation',
    })
  })

  it('does not mark founder away before a future absence starts', () => {
    expect(
      deriveActiveCalendarAbsence(
        [
          {
            source: 'merchant_calendar_events',
            title: 'August leave',
            kind: 'vacation',
            startAt: new Date('2026-08-01T00:00:00.000Z'),
            endAt: new Date('2026-08-15T23:59:59.000Z'),
          },
        ],
        new Date('2026-04-24T10:00:00.000Z')
      )
    ).toBeNull()
  })

  it('clears expired calendar-driven vacation state after return date', () => {
    expect(
      shouldClearExpiredCalendarVacation({
        state: 'Vacation',
        until: new Date('2026-04-20T23:59:59.000Z'),
        now: new Date('2026-04-24T10:00:00.000Z'),
      })
    ).toBe(true)

    expect(
      shouldClearExpiredCalendarVacation({
        state: 'Sick',
        until: new Date('2026-04-20T23:59:59.000Z'),
        now: new Date('2026-04-24T10:00:00.000Z'),
      })
    ).toBe(false)
  })
})
