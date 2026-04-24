type CalendarEventDeleteCandidate = {
  id: string
  kind?: string
  locked?: boolean
}

export function getCalendarEventDeleteTarget<T extends CalendarEventDeleteCandidate>(
  detailEvent: T | null | undefined,
  selectedEvent: T | null | undefined
): T | null {
  return detailEvent ?? selectedEvent ?? null
}

export function canDeleteCalendarEvent(event: CalendarEventDeleteCandidate | null | undefined) {
  return Boolean(event && !event.locked)
}
