import { prisma } from '@/lib/prisma'

export type CalendarAbsenceEvent = {
  source: 'calendar_events' | 'merchant_calendar_events'
  title: string
  kind: string
  startAt: Date
  endAt: Date
}

export type ActiveCalendarAbsence = {
  state: 'Vacation'
  until: Date
  source: CalendarAbsenceEvent['source']
  title: string
}

const ABSENCE_KINDS = new Set(['leave', 'vacation', 'absence', 'blackout'])

function isAbsenceKind(value: string | null | undefined) {
  return ABSENCE_KINDS.has(String(value || '').trim().toLowerCase())
}

export function deriveActiveCalendarAbsence(
  events: CalendarAbsenceEvent[],
  now = new Date()
): ActiveCalendarAbsence | null {
  const active = events
    .filter((event) => isAbsenceKind(event.kind))
    .filter((event) => event.startAt <= now && event.endAt >= now)
    .sort((left, right) => right.endAt.getTime() - left.endAt.getTime())[0]

  if (!active) return null

  return {
    state: 'Vacation',
    until: active.endAt,
    source: active.source,
    title: active.title,
  }
}

export function shouldClearExpiredCalendarVacation(args: {
  state: string | null | undefined
  until: Date | string | null | undefined
  now?: Date
}) {
  if (String(args.state || '').toLowerCase() !== 'vacation') return false
  if (!args.until) return false

  const until = args.until instanceof Date ? args.until : new Date(args.until)
  if (Number.isNaN(until.getTime())) return false

  return until < (args.now ?? new Date())
}

async function listCalendarAbsenceEvents(userId: string) {
  const [calendarEvents, merchantCalendarEvents] = await Promise.all([
    prisma.$queryRaw<CalendarAbsenceEvent[]>`
      SELECT
        'calendar_events'::text AS source,
        title,
        kind,
        start_at AS "startAt",
        end_at AS "endAt"
      FROM public.calendar_events
      WHERE user_id = ${userId}::uuid
        AND kind = 'leave'
        AND end_at >= now() - interval '1 day'
    `,
    prisma.merchantCalendarEvent.findMany({
      where: {
        user_id: userId,
        event_type: { in: ['vacation', 'absence', 'blackout'] },
        end_date: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
      },
      select: {
        title: true,
        event_type: true,
        start_date: true,
        end_date: true,
      },
    }),
  ])

  return [
    ...calendarEvents,
    ...merchantCalendarEvents.map((event) => ({
      source: 'merchant_calendar_events' as const,
      title: event.title,
      kind: event.event_type,
      startAt: event.start_date,
      endAt: event.end_date,
    })),
  ]
}

export async function syncFounderStateFromCalendarForUser(userId: string, now = new Date()) {
  const events = await listCalendarAbsenceEvents(userId)
  const activeAbsence = deriveActiveCalendarAbsence(events, now)

  if (activeAbsence) {
    return prisma.founderState.upsert({
      where: { user_id: userId },
      update: {
        state: activeAbsence.state,
        until: activeAbsence.until,
        notes: `Synced from ${activeAbsence.source}: ${activeAbsence.title}`,
      },
      create: {
        user_id: userId,
        state: activeAbsence.state,
        until: activeAbsence.until,
        notes: `Synced from ${activeAbsence.source}: ${activeAbsence.title}`,
      },
    })
  }

  const founder = await prisma.founderState.findUnique({
    where: { user_id: userId },
    select: { state: true, until: true },
  })

  if (
    shouldClearExpiredCalendarVacation({
      state: founder?.state,
      until: founder?.until,
      now,
    })
  ) {
    return prisma.founderState.update({
      where: { user_id: userId },
      data: {
        state: 'Available',
        until: null,
        notes: 'Calendar absence ended',
      },
    })
  }

  return founder
}
