'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'

type CalendarView = 'month' | 'week' | 'day'
type EventKind = 'holiday' | 'celebration' | 'peak' | 'leave'
type EventImpact = 'low' | 'medium' | 'high' | 'critical'

type CalendarEvent = {
  id: string
  title: string
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  kind: EventKind
  impact: EventImpact
  zone: string
  notes: string
  locked?: boolean
}

type EventForm = Omit<CalendarEvent, 'id' | 'locked'>
type CalendarEventPatch = Partial<Omit<CalendarEvent, 'id'>>
type ParsedNaturalEvent = {
  event: EventForm
  confidence: 'high' | 'medium' | 'low'
  summary: string
}
type EventChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoningSummary?: string
}

const eventKinds: Record<EventKind, { label: string; color: string; chip: string; border: string }> = {
  holiday: {
    label: 'Public holiday',
    color: 'bg-slate-500',
    chip: 'bg-slate-100 text-[#30373E]',
    border: 'border-slate-200',
  },
  celebration: {
    label: 'Celebration',
    color: 'bg-[#E0A93A]/100',
    chip: 'bg-[#E0A93A]/10 text-amber-800',
    border: 'border-amber-200',
  },
  peak: {
    label: 'Peak period',
    color: 'bg-fuchsia-600',
    chip: 'bg-fuchsia-50 text-fuchsia-800',
    border: 'border-fuchsia-200',
  },
  leave: {
    label: 'Time off',
    color: 'bg-sky-600',
    chip: 'bg-sky-50 text-sky-800',
    border: 'border-sky-200',
  },
}

const fallbackKind = { label: 'Other', color: 'bg-slate-400', chip: 'bg-slate-100 text-[#6B7480]', border: 'border-slate-200' }

function getKindStyle(kind: string) {
  return eventKinds[kind as EventKind] || fallbackKind
}

const impactLabels: Record<EventImpact, { label: string; chip: string }> = {
  low: { label: 'Low', chip: 'bg-slate-100 text-[#6B7480]' },
  medium: { label: 'Medium', chip: 'bg-[#E0A93A]/10 text-amber-700' },
  high: { label: 'High', chip: 'bg-orange-50 text-orange-700' },
  critical: { label: 'Critical', chip: 'bg-[#FFE7EC] text-red-700 ring-1 ring-red-200' },
}

const today = new Date()
const todayKey = toDateKey(today)
const monthNames: Record<string, number> = {
  janvier: 1,
  janv: 1,
  fevrier: 2,
  février: 2,
  fev: 2,
  fév: 2,
  mars: 3,
  avril: 4,
  avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  juil: 7,
  aout: 8,
  août: 8,
  septembre: 9,
  sept: 9,
  octobre: 10,
  oct: 10,
  novembre: 11,
  nov: 11,
  decembre: 12,
  décembre: 12,
  dec: 12,
  déc: 12,
}
const weekdayNames: Record<string, number> = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
  dimanche: 0,
}

const francePublicHolidays2026: CalendarEvent[] = [
  ['jour-an', "New Year's Day", '2026-01-01'],
  ['lundi-paques', 'Easter Monday', '2026-04-06'],
  ['fete-travail', 'Labour Day', '2026-05-01'],
  ['victoire-1945', 'Victory in Europe Day', '2026-05-08'],
  ['ascension', 'Ascension Day', '2026-05-14'],
  ['lundi-pentecote', 'Whit Monday', '2026-05-25'],
  ['fete-nationale', 'Bastille Day', '2026-07-14'],
  ['assomption', 'Assumption Day', '2026-08-15'],
  ['toussaint', "All Saints' Day", '2026-11-01'],
  ['armistice', 'Armistice Day', '2026-11-11'],
  ['noel', 'Christmas Day', '2026-12-25'],
].map(([slug, title, date]) => ({
  id: `holiday-fr-${slug}-2026`,
  title,
  startDate: date,
  endDate: date,
  startTime: '',
  endTime: '',
  kind: 'holiday',
  impact: 'medium',
  zone: 'France',
  notes: 'Public holiday: expect closures, carrier delays and spikes before/after.',
  locked: true,
}))

const initialEvents: CalendarEvent[] = [
  ...francePublicHolidays2026,
  {
    id: 'commerce-winter-sales-2026',
    title: 'Winter sales',
    startDate: '2026-01-07',
    endDate: '2026-02-03',
    startTime: '',
    endTime: '',
    kind: 'peak',
    impact: 'high',
    zone: 'France / e-commerce',
    notes: 'Prepare promotions, stock, pricing, customer support and logistics capacity over 4 weeks.',
    locked: true,
  },
  {
    id: 'commerce-black-friday-2026',
    title: 'Black Friday / Cyber Monday',
    startDate: '2026-11-27',
    endDate: '2026-11-30',
    startTime: '',
    endTime: '',
    kind: 'peak',
    impact: 'critical',
    zone: 'International',
    notes: 'Traffic peak, aggressive promotions, stock tension and reinforced customer support.',
    locked: true,
  },
  {
    id: 'commerce-christmas-returns-2026',
    title: 'Christmas + post-holiday returns',
    startDate: '2026-12-01',
    endDate: '2027-01-10',
    startTime: '',
    endTime: '',
    kind: 'peak',
    impact: 'critical',
    zone: 'France / Europe',
    notes: 'Gift peak, shipping constraints, then expected surge in returns and exchanges.',
    locked: true,
  },
  {
    id: 'commerce-chinese-new-year-2026',
    title: 'Chinese New Year',
    startDate: '2026-02-17',
    endDate: '2026-02-24',
    startTime: '',
    endTime: '',
    kind: 'celebration',
    impact: 'critical',
    zone: 'China / international sourcing',
    notes: 'Plan ahead for supplier closures, production delays, transport booking and import stockouts.',
    locked: true,
  },
  {
    id: 'commerce-ramadan-eid-2026',
    title: 'Ramadan + Eid al-Fitr',
    startDate: '2026-02-18',
    endDate: '2026-03-20',
    startTime: '',
    endTime: '',
    kind: 'celebration',
    impact: 'high',
    zone: 'International',
    notes: 'Adapt assortment, campaigns, operational hours and demand forecasts by market.',
    locked: true,
  },
  {
    id: 'commerce-singles-day-2026',
    title: "Singles' Day 11.11",
    startDate: '2026-11-11',
    endDate: '2026-11-11',
    startTime: '',
    endTime: '',
    kind: 'peak',
    impact: 'high',
    zone: 'China / marketplaces',
    notes: 'Major e-commerce promotional peak — useful for marketplace monitoring and cross-border ops.',
    locked: true,
  },
  {
    id: 'commerce-back-to-school-2026',
    title: 'Back to School',
    startDate: '2026-08-24',
    endDate: '2026-09-06',
    startTime: '',
    endTime: '',
    kind: 'peak',
    impact: 'medium',
    zone: 'France / Europe',
    notes: 'Prepare campaigns, seasonal stock and demand surge from late August to early September.',
    locked: true,
  },
  {
    id: 'commerce-parents-days-2026',
    title: "Mother's Day / Father's Day",
    startDate: '2026-05-31',
    endDate: '2026-06-21',
    startTime: '',
    endTime: '',
    kind: 'celebration',
    impact: 'medium',
    zone: 'France',
    notes: 'Gift window — leverage with targeted campaigns, bundles and guaranteed delivery SLAs.',
    locked: true,
  },
  {
    id: 'commerce-valentine-2026',
    title: "Valentine's Day",
    startDate: '2026-02-14',
    endDate: '2026-02-14',
    startTime: '',
    endTime: '',
    kind: 'celebration',
    impact: 'medium',
    zone: 'International',
    notes: 'Gift peak — time-boxed offers and strict on-time delivery expectations.',
    locked: true,
  },
]

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateKeyFromParts(day: number, month: number, year = today.getFullYear()) {
  return toDateKey(new Date(year, month - 1, day))
}

function formatDateFr(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parseDateKey(dateKey))
}

function formatDateRangeFr(startDate: string, endDate: string) {
  return startDate === endDate ? formatDateFr(startDate) : `${formatDateFr(startDate)} — ${formatDateFr(endDate)}`
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function addDays(dateKey: string, days: number) {
  const next = parseDateKey(dateKey)
  next.setDate(next.getDate() + days)
  return toDateKey(next)
}

function daysBetween(startDate: string, endDate: string) {
  const start = parseDateKey(startDate).getTime()
  const end = parseDateKey(endDate).getTime()
  return Math.max(0, Math.round((end - start) / 86400000))
}

function isDateInRange(dateKey: string, event: CalendarEvent) {
  return dateKey >= event.startDate && dateKey <= event.endDate
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
}

function titleCase(value: string) {
  const clean = value.trim()
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : ''
}

function nextWeekdayDate(weekday: number, forceNextWeek = false) {
  const date = new Date(today)
  const current = date.getDay()
  let diff = (weekday - current + 7) % 7
  if (diff === 0 || forceNextWeek) diff += 7
  date.setDate(date.getDate() + diff)
  return toDateKey(date)
}

function nextWeekdayAfter(dateKey: string, weekday: number) {
  const date = parseDateKey(dateKey)
  const current = date.getDay()
  let diff = (weekday - current + 7) % 7
  if (diff === 0) diff = 7
  date.setDate(date.getDate() + diff)
  return toDateKey(date)
}

function parseHour(value: string) {
  const match = value.match(/(\d{1,2})(?::|h)?(\d{2})?/)
  if (!match) return ''
  const hour = Math.min(23, Number(match[1]))
  const minute = Math.min(59, Number(match[2] || '00'))
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function inferKind(text: string): EventKind {
  if (/(conge|conges|vacance|vacances|absence|cp|rtt)/.test(text)) return 'leave'
  if (/(ferie|feries|fermeture|ferme)/.test(text)) return 'holiday'
  if (/(soldes|black friday|cyber monday|promo|promotion|rentre|singles day|commerce)/.test(text)) return 'peak'
  if (/(fete|saint valentin|noel|nouvel an|ramadan|aid|paques|meres|peres|halloween|epiphanie)/.test(text)) return 'celebration'
  return 'leave'
}

function inferImpact(text: string, kind: EventKind): EventImpact {
  if (/(critique|critical|bloquant|majeur)/.test(text)) return 'critical'
  if (/(fort|haute|high|important|gros)/.test(text)) return 'high'
  if (/(faible|low|mineur)/.test(text)) return 'low'
  if (kind === 'peak') return 'high'
  return 'medium'
}

function inferZone(text: string, kind: EventKind) {
  if (/(chine|chinois|sourcing|import)/.test(text)) return 'Chine / sourcing international'
  if (/(france|ferie|soldes)/.test(text)) return 'France'
  if (kind === 'leave') return 'Interne'
  return 'Internal'
}

function removeCommandWords(value: string) {
  return value
    .replace(/\b(ajoute|ajouter|cree|crée|creer|créer|mets|mettre|pose|planifie|programme)\b/gi, '')
    .replace(/\b(mes|mon|ma|un|une|des|les|en)\b/gi, ' ')
    .replace(/\b(je prends|je pose|je serai|je suis|j ai|j'ai)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferTitle(original: string, text: string, kind: EventKind) {
  if (kind === 'leave') return 'Time off'

  const cleaned = removeCommandWords(original)
  const beforeDate = cleaned
    .replace(/\bdu\b.+$/i, '')
    .replace(/\ble\b.+$/i, '')
    .replace(/\bde\b.+$/i, '')
    .replace(/\b(demain|aujourd'hui|aujourd hui|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|prochain|prochaine)\b.+$/i, '')
    .replace(/\btoute la journ[ée]e\b/gi, '')
    .trim()

  if (beforeDate.length >= 3) return titleCase(beforeDate)
  if (kind === 'holiday') return text.includes('fermeture') ? 'Closure' : 'Public holiday'
  if (kind === 'celebration') return 'Celebration'
  if (kind === 'peak') return 'Peak period'
  return 'Time off'
}

function parseNaturalDates(text: string, fallbackDate: string) {
  const numericRange = text.match(/(?:du\s+)?(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\s+(?:au|a|-)\s+(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/)
  if (numericRange) {
    const startYear = Number(numericRange[3] || today.getFullYear())
    const endYear = Number(numericRange[6] || startYear)
    const normalizedStartYear = startYear < 100 ? 2000 + startYear : startYear
    const normalizedEndYear = endYear < 100 ? 2000 + endYear : endYear
    return {
      startDate: toDateKeyFromParts(Number(numericRange[1]), Number(numericRange[2]), normalizedStartYear),
      endDate: toDateKeyFromParts(Number(numericRange[4]), Number(numericRange[5]), normalizedEndYear),
    }
  }

  const monthAlternatives = Object.keys(monthNames).join('|')
  const textRange = text.match(new RegExp(`(?:du\\s+)?(\\d{1,2})\\s+(?:au|a|-)\\s+(\\d{1,2})\\s+(${monthAlternatives})(?:\\s+(\\d{4}))?`))
  if (textRange) {
    const month = monthNames[textRange[3]]
    const year = Number(textRange[4] || today.getFullYear())
    return {
      startDate: toDateKeyFromParts(Number(textRange[1]), month, year),
      endDate: toDateKeyFromParts(Number(textRange[2]), month, year),
    }
  }

  const singleTextDate = text.match(new RegExp(`(?:le\\s+)?(\\d{1,2})\\s+(${monthAlternatives})(?:\\s+(\\d{4}))?`))
  if (singleTextDate) {
    const date = toDateKeyFromParts(Number(singleTextDate[1]), monthNames[singleTextDate[2]], Number(singleTextDate[3] || today.getFullYear()))
    return { startDate: date, endDate: date }
  }

  const singleNumericDate = text.match(/(?:le\s+)?(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/)
  if (singleNumericDate) {
    const year = Number(singleNumericDate[3] || today.getFullYear())
    const normalizedYear = year < 100 ? 2000 + year : year
    const date = toDateKeyFromParts(Number(singleNumericDate[1]), Number(singleNumericDate[2]), normalizedYear)
    return { startDate: date, endDate: date }
  }

  if (text.includes('demain')) {
    const date = addDays(todayKey, 1)
    return { startDate: date, endDate: date }
  }

  if (text.includes('aujourd hui') || text.includes('aujourdhui')) {
    return { startDate: todayKey, endDate: todayKey }
  }

  const weekdays = Object.entries(weekdayNames).filter(([name]) => new RegExp(`\\b${name}\\b`).test(text))
  if (weekdays.length >= 2) {
    const firstDate = nextWeekdayDate(weekdays[0][1], text.includes('semaine prochaine'))
    const lastDate = weekdays.slice(1).reduce((date, [, weekday]) => nextWeekdayAfter(date, weekday), firstDate)
    return { startDate: firstDate, endDate: lastDate }
  }

  const weekday = weekdays[0]
  if (weekday) {
    const date = nextWeekdayDate(weekday[1], text.includes('semaine prochaine'))
    return { startDate: date, endDate: date }
  }

  return { startDate: fallbackDate, endDate: fallbackDate }
}

function parseNaturalTimes(text: string) {
  if (/(toute la journee|toute la journe|journee complete|all day)/.test(text)) {
    return { startTime: '', endTime: '' }
  }

  const range = text.match(/(?:de|entre)\s+(\d{1,2}(?::|h)?\d{0,2})\s+(?:a|et|-)\s+(\d{1,2}(?::|h)?\d{0,2})/)
  if (range) return { startTime: parseHour(range[1]), endTime: parseHour(range[2]) }

  if (/(apres midi|aprem|apres-midi)/.test(text)) return { startTime: '14:00', endTime: '18:00' }
  if (/(matin|matinee)/.test(text)) return { startTime: '09:00', endTime: '12:00' }
  if (/(soir|soiree)/.test(text)) return { startTime: '18:00', endTime: '21:00' }

  const single = text.match(/(?:a|vers)\s+(\d{1,2}(?::|h)?\d{0,2})/)
  if (single) {
    const startTime = parseHour(single[1])
    return { startTime, endTime: startTime }
  }

  return { startTime: '', endTime: '' }
}

function parseNaturalEvent(input: string, fallbackDate: string): ParsedNaturalEvent | null {
  const original = input.trim()
  if (original.length < 3) return null

  const text = normalizeText(original)
  const kind = inferKind(text)
  const impact = inferImpact(text, kind)
  const zone = inferZone(text, kind)
  const title = inferTitle(original, text, kind)
  const dates = parseNaturalDates(text, fallbackDate)
  const times = parseNaturalTimes(text)
  const endDate = dates.endDate >= dates.startDate ? dates.endDate : dates.startDate
  const hasExplicitDate = /(du|le|demain|aujourd|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|\d{1,2}[\/.-]\d{1,2}|\d{1,2}\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre))/.test(text)
  const confidence: ParsedNaturalEvent['confidence'] = hasExplicitDate && title ? 'high' : hasExplicitDate ? 'medium' : 'low'

  return {
    event: {
      title,
      startDate: dates.startDate,
      endDate,
      startTime: times.startTime,
      endTime: times.endTime,
      kind,
      impact,
      zone,
      notes: `Created from natural input: "${original}"`,
    },
    confidence,
    summary: `${title} · ${formatDateRangeFr(dates.startDate, endDate)}${times.startTime ? ` · ${times.startTime}${times.endTime ? `-${times.endTime}` : ''}` : ' · all day'}`,
  }
}

async function requestCalendarEvents(url: string, options?: RequestInit) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || 'Calendar error')
  }

  return data
}

async function createCalendarEvent(event: CalendarEvent) {
  return requestCalendarEvents('/api/calendar-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      startTime: event.startTime,
      endTime: event.endTime,
      kind: event.kind,
      impact: event.impact,
      zone: event.zone,
      notes: event.notes,
      locked: event.locked || false,
    }),
  }) as Promise<CalendarEvent>
}

async function updateCalendarEvent(id: string, patch: CalendarEventPatch) {
  return requestCalendarEvents(`/api/calendar-events/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }) as Promise<CalendarEvent>
}

async function deleteCalendarEvent(id: string) {
  return requestCalendarEvents(`/api/calendar-events/${id}`, { method: 'DELETE' })
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}

function buildMonthDays(activeMonth: Date) {
  const year = activeMonth.getFullYear()
  const month = activeMonth.getMonth()
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return {
      date,
      key: toDateKey(date),
      inMonth: date.getMonth() === month,
      isToday: toDateKey(date) === todayKey,
    }
  })
}

const emptyForm: EventForm = {
  title: '',
  startDate: todayKey,
  endDate: todayKey,
  startTime: '',
  endTime: '',
  kind: 'leave',
  impact: 'medium',
  zone: 'Interne',
  notes: '',
}

export default function CalendarPageClient() {
  const naturalInputRef = useRef<HTMLTextAreaElement | null>(null)
  const [calendarView, setCalendarView] = useState<CalendarView>('month')
  const [activeMonth, setActiveMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [selectedEventId, setSelectedEventId] = useState<string | null>('commerce-chinese-new-year-2026')
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null)
  const [detailEventId, setDetailEventId] = useState<string | null>(null)
  const [isCreatingFromDate, setIsCreatingFromDate] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [savingIds, setSavingIds] = useState<string[]>([])
  const [syncError, setSyncError] = useState<string | null>(null)
  const [form, setForm] = useState<EventForm>(emptyForm)
  const [naturalInput, setNaturalInput] = useState('')
  const [tlRange, setTlRange] = useState(90)
  const [eventChatInput, setEventChatInput] = useState('')
  const [eventChatMessages, setEventChatMessages] = useState<EventChatMessage[]>([])
  const [eventChatError, setEventChatError] = useState<string | null>(null)
  const [eventChatSessionId, setEventChatSessionId] = useState<string | null>(null)
  const [eventChatSending, setEventChatSending] = useState(false)

  useEffect(() => {
    let ignore = false

    const loadEvents = async () => {
      try {
        setSyncError(null)
        const data = (await requestCalendarEvents('/api/calendar-events')) as CalendarEvent[]

        if (ignore) return

        if (data.length > 0) {
          setEvents(data)
          setSelectedEventId(data.find((event) => event.title === 'Nouvel An chinois')?.id || data[0].id)
          setSelectedDate(data.find((event) => event.title === 'Nouvel An chinois')?.startDate || todayKey)
          return
        }

        const seeded = await Promise.all(initialEvents.map((event) => createCalendarEvent(event)))
        if (ignore) return
        setEvents(seeded)
        setSelectedEventId(seeded.find((event) => event.title === 'Nouvel An chinois')?.id || seeded[0]?.id || null)
        setSelectedDate(seeded.find((event) => event.title === 'Nouvel An chinois')?.startDate || todayKey)
      } catch (error) {
        if (!ignore) {
          setSyncError(error instanceof Error ? error.message : 'Unable to sync calendar')
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    loadEvents()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    setEventChatInput('')
    setEventChatMessages([])
    setEventChatError(null)
    setEventChatSessionId(null)
    setEventChatSending(false)
  }, [detailEventId])

  const monthDays = useMemo(() => buildMonthDays(activeMonth), [activeMonth])
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId]
  )
  const detailEvent = useMemo(
    () => (detailEventId ? events.find((event) => event.id === detailEventId) || null : null),
    [events, detailEventId]
  )
  const selectedDateEvents = events
    .filter((event) => isDateInRange(selectedDate, event))
    .sort((a, b) => `${a.startDate}${a.startTime}${a.title}`.localeCompare(`${b.startDate}${b.startTime}${b.title}`))

  const counts = Object.entries(eventKinds).map(([value, kind]) => ({
    value: value as EventKind,
    ...kind,
    count: events.filter((event) => event.kind === value).length,
  }))
  const parsedNaturalEvent = useMemo(
    () => parseNaturalEvent(naturalInput, form.startDate || selectedDate),
    [form.startDate, naturalInput, selectedDate]
  )

  const saveDraftEvent = async (draft: EventForm) => {
    const startDate = draft.startDate
    const endDate = draft.endDate && draft.endDate >= startDate ? draft.endDate : startDate
    const draftEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      ...draft,
      title: draft.title.trim(),
      startDate,
      endDate,
      notes: draft.notes.trim(),
    }

    try {
      setSyncError(null)
      const newEvent = await createCalendarEvent(draftEvent)
      setEvents((current) => [...current, newEvent])
      setSelectedDate(newEvent.startDate)
      setSelectedEventId(newEvent.id)
      setForm(emptyForm)
      setNaturalInput('')
      setIsCreatingFromDate(false)
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Unable to create event')
    }
  }

  const createEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!parsedNaturalEvent) {
      setSyncError('Describe an event — e.g. "time off from May 5 to May 10, all day"')
      return
    }
    await saveDraftEvent(parsedNaturalEvent.event)
  }

  const updateSelectedEvent = (patch: Partial<CalendarEvent>) => {
    if (!selectedEvent) return
    const previousEvent = selectedEvent
    let patchedEvent: CalendarEvent | null = null

    setEvents((current) =>
      current.map((event) => {
        if (event.id !== selectedEvent.id) return event
        const next = { ...event, ...patch }
        if (next.endDate < next.startDate) {
          next.endDate = next.startDate
        }
        patchedEvent = next
        return next
      })
    )

    setSavingIds((current) => Array.from(new Set([...current, selectedEvent.id])))
    setSyncError(null)

    updateCalendarEvent(selectedEvent.id, patch)
      .then((savedEvent) => {
        setEvents((current) => current.map((event) => (event.id === savedEvent.id ? savedEvent : event)))
      })
      .catch((error) => {
        setEvents((current) => current.map((event) => (event.id === previousEvent.id ? previousEvent : event)))
        setSyncError(error instanceof Error ? error.message : 'Unable to update event')
      })
      .finally(() => {
        if (patchedEvent) {
          setSavingIds((current) => current.filter((id) => id !== selectedEvent.id))
        }
      })
  }

  const isAwayFromToday =
    activeMonth.getFullYear() !== today.getFullYear() || activeMonth.getMonth() !== today.getMonth()

  const moveMonth = (offset: number) => {
    setActiveMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const goToToday = () => {
    setActiveMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    chooseDate(todayKey)
  }

  const activeWeekStart = useMemo(() => {
    const d = parseDateKey(selectedDate)
    const day = d.getDay()
    const diff = (day + 6) % 7
    d.setDate(d.getDate() - diff)
    return toDateKey(d)
  }, [selectedDate])

  const weekDays = useMemo(() => {
    const start = parseDateKey(activeWeekStart)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return { date: d, key: toDateKey(d), isToday: toDateKey(d) === todayKey }
    })
  }, [activeWeekStart])

  const moveWeek = (offset: number) => {
    const d = parseDateKey(selectedDate)
    d.setDate(d.getDate() + offset * 7)
    const key = toDateKey(d)
    chooseDate(key)
    setActiveMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }

  const moveDay = (offset: number) => {
    const next = addDays(selectedDate, offset)
    chooseDate(next)
    const d = parseDateKey(next)
    setActiveMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }

  const viewLabels: Record<CalendarView, string> = { month: 'Month', week: 'Week', day: 'Day' }

  const chooseDate = (dateKey: string) => {
    setSelectedDate(dateKey)
    setForm((current) => ({ ...current, startDate: dateKey, endDate: dateKey }))
  }

  const startCreateFromDate = (dateKey: string) => {
    chooseDate(dateKey)
    setSelectedEventId(null)
    setIsCreatingFromDate(true)
    setTimeout(() => naturalInputRef.current?.focus(), 0)
  }

  const dropEvent = (dateKey: string) => {
    if (!draggedEventId) return
    const movedEvent = events.find((event) => event.id === draggedEventId)
    if (!movedEvent) return
    const duration = daysBetween(movedEvent.startDate, movedEvent.endDate)
    const patch = { startDate: dateKey, endDate: addDays(dateKey, duration) }

    setEvents((current) =>
      current.map((event) => {
        if (event.id !== draggedEventId) return event
        return { ...event, ...patch }
      })
    )
    setSelectedDate(dateKey)
    setSelectedEventId(draggedEventId)
    setDraggedEventId(null)
    setSavingIds((current) => Array.from(new Set([...current, movedEvent.id])))
    setSyncError(null)

    updateCalendarEvent(movedEvent.id, patch)
      .then((savedEvent) => {
        setEvents((current) => current.map((event) => (event.id === savedEvent.id ? savedEvent : event)))
      })
      .catch((error) => {
        setEvents((current) => current.map((event) => (event.id === movedEvent.id ? movedEvent : event)))
        setSyncError(error instanceof Error ? error.message : 'Unable to move event')
      })
      .finally(() => {
        setSavingIds((current) => current.filter((id) => id !== movedEvent.id))
      })
  }

  const deleteSelectedEvent = async () => {
    if (!selectedEvent) return
    const eventToDelete = selectedEvent
    setEvents((current) => current.filter((event) => event.id !== eventToDelete.id))
    setSelectedEventId(null)

    try {
      setSyncError(null)
      await deleteCalendarEvent(eventToDelete.id)
    } catch (error) {
      setEvents((current) => [...current, eventToDelete])
      setSelectedEventId(eventToDelete.id)
      setSyncError(error instanceof Error ? error.message : 'Unable to delete event')
    }
  }

  const sendEventChatMessage = async (rawMessage: string) => {
    if (!detailEvent) return

    const message = rawMessage.trim()
    if (!message || eventChatSending) return

    setEventChatSending(true)
    setEventChatError(null)
    setEventChatMessages((current) => [
      ...current,
      { id: `u-${Date.now()}`, role: 'user', content: message },
    ])

    const eventContext = [
      'Calendar event context:',
      `Title: ${detailEvent.title}`,
      `Date range: ${formatDateRangeFr(detailEvent.startDate, detailEvent.endDate)}`,
      `Impact: ${impactLabels[detailEvent.impact].label}`,
      `Type: ${getKindStyle(detailEvent.kind).label}`,
      `Zone: ${detailEvent.zone}`,
      detailEvent.notes ? `Current recommendation: ${detailEvent.notes}` : '',
    ]
      .filter(Boolean)
      .join('\n')

    try {
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: eventChatSessionId || undefined,
          message: `${message}\n\n${eventContext}`,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Leia is unavailable right now.')
      }

      if (typeof payload?.sessionId === 'string' && payload.sessionId) {
        setEventChatSessionId(payload.sessionId)
      }

      const assistantContent =
        typeof payload?.message?.content === 'string'
          ? payload.message.content
          : 'Leia could not generate a response for this event.'
      const reasoningSummary =
        typeof payload?.message?.reasoning_summary === 'string'
          ? payload.message.reasoning_summary
          : undefined

      setEventChatMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: assistantContent,
          reasoningSummary,
        },
      ])
      setEventChatInput('')
    } catch (error) {
      setEventChatError(error instanceof Error ? error.message : 'Leia is unavailable right now.')
    } finally {
      setEventChatSending(false)
    }
  }

  const submitEventChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await sendEventChatMessage(eventChatInput)
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-card p-5 sm:p-6">
        <div>
          <p className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Operational planning</p>
          <h1 className="mt-2 font-serif text-[22px] font-bold tracking-tight text-[#03182F]">Calendar</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#6B7480]">
            Track time off, public holidays and commercial peak periods that may affect your sales, stock and deliveries.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isLoading && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[#6B7480]">
                Loading from Supabase…
              </span>
            )}
            {savingIds.length > 0 && (
              <span className="rounded-full bg-[#2764FF]/10 px-3 py-1 text-xs font-semibold text-[#004bd9]">
                Saving…
              </span>
            )}
            {syncError && (
              <span className="rounded-full bg-[#FFE7EC] px-3 py-1 text-xs font-semibold text-red-700">
                {syncError}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="dashboard-card p-5 sm:p-7">
        <div className="flex items-center justify-between mb-8">
          <p className="font-serif text-base font-bold text-[#03182F]">Upcoming events</p>
          <div className="inline-flex rounded-lg border border-[#DDE5EE] bg-slate-50 p-0.5">
            {[{ v: 30, l: '30 days' }, { v: 90, l: '3 months' }, { v: 180, l: '6 months' }].map((o) => (
              <button key={o.v} type="button" onClick={() => setTlRange(o.v)}
                className={`rounded-md px-3 py-1 font-serif text-[13px] font-medium transition ${tlRange === o.v ? 'bg-white text-[#03182F] shadow-sm' : 'text-[#6B7480] hover:text-[#30373E]'}`}
              >{o.l}</button>
            ))}
          </div>
        </div>
        {(() => {
          const rs = parseDateKey(todayKey)
          const re = new Date(rs.getFullYear(), rs.getMonth(), rs.getDate() + tlRange)
          const rek = toDateKey(re)
          const td = Math.max(1, tlRange)
          const tl = events.filter((e) => e.kind !== 'leave' && e.endDate >= todayKey && e.startDate <= rek).sort((a, b) => a.startDate.localeCompare(b.startDate))
          const pc = (dk: string) => { const d = parseDateKey(dk); return Math.max(2, Math.min(97, (Math.round((d.getTime() - rs.getTime()) / 86400000) / td) * 100)) }
          const sd = (dk: string) => new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(parseDateKey(dk))
          // Fewer events + wider breathing room on longer ranges (30j: 5 · 3mo: 6 · 6mo: 7)
          const mx = tlRange <= 30 ? 5 : tlRange <= 90 ? 6 : 7
          const vis = tl.slice(0, mx)
          // Bumped minimum spacing (was 8) so labels never collide
          const mg = Math.max(15, (100 / Math.max(vis.length, 1)))
          const pos: number[] = []
          vis.forEach((e) => { let p = pc(e.startDate < todayKey ? todayKey : e.startDate); if (pos.length > 0 && p - pos[pos.length - 1] < mg) p = Math.min(95, pos[pos.length - 1] + mg); pos.push(p) })
          if (vis.length === 0) return <p className="text-sm text-[#6B7480]">No events in this period.</p>
          return (
            <div className="relative px-4">
              <div className="absolute left-4 right-4 top-3 h-px bg-slate-200" />
              <div className="absolute top-0 left-0">
                <div className="h-6 w-6 -translate-x-1/2 flex items-center justify-center"><div className="h-2.5 w-2.5 rounded-full border-2 border-slate-400 bg-white" /></div>
                <p className="mt-1 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider text-[#6B7480] whitespace-nowrap">Today</p>
              </div>
              {vis.map((evt, i) => { const k = getKindStyle(evt.kind); return (
                <div key={evt.id} className="absolute cursor-pointer group" style={{ left: `${pos[i]}%` }}
                  onClick={() => { setDetailEventId(evt.id); setSelectedDate(evt.startDate); setActiveMonth(new Date(parseDateKey(evt.startDate).getFullYear(), parseDateKey(evt.startDate).getMonth(), 1)) }}>
                  <div className="h-6 w-6 -translate-x-1/2 flex items-center justify-center"><div className={`h-3 w-3 rounded-full ${k.color} ring-2 ring-white transition group-hover:scale-125`} /></div>
                  <div className="mt-2 -translate-x-1/2 w-24 text-center">
                    <p className="font-serif text-[12px] font-bold text-[#03182F] truncate leading-tight">{evt.title}</p>
                    <p className="font-serif text-[11px] text-[#6B7480] capitalize mt-0.5">{sd(evt.startDate)}</p>
                  </div>
                </div>
              ) })}
              <div className="h-20" />
            </div>
          )
        })()}
      </section>

      <div>
        <section className="dashboard-card overflow-hidden p-4 sm:p-5">
          <div className="mb-4 inline-flex rounded-lg border border-[#DDE5EE] bg-slate-50 p-0.5">
            {[{ value: 'day' as CalendarView, label: 'Day' }, { value: 'week' as CalendarView, label: 'Week' }, { value: 'month' as CalendarView, label: 'Month' }].map((o) => (
              <button key={o.value} type="button" onClick={() => setCalendarView(o.value)}
                className={`rounded-md px-4 py-2 font-serif text-[13px] font-medium transition ${calendarView === o.value ? 'bg-white text-[#03182F] shadow-sm' : 'text-[#6B7480] hover:text-[#30373E]'}`}
              >{o.label}</button>
            ))}
          </div>
          {/* --- Navigation bar --- */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <button
              type="button"
              onClick={() => calendarView === 'month' ? moveMonth(-1) : calendarView === 'week' ? moveWeek(-1) : moveDay(-1)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#6B7480] transition hover:bg-slate-100 hover:text-[#30373E]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              {calendarView === 'month' && (
                <span className="hidden sm:inline capitalize">{monthLabel(new Date(activeMonth.getFullYear(), activeMonth.getMonth() - 1, 1))}</span>
              )}
            </button>
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-lg font-bold capitalize text-[#03182F] sm:text-xl">
                {calendarView === 'month' && monthLabel(activeMonth)}
                {calendarView === 'week' && `Week of ${new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(parseDateKey(activeWeekStart))}`}
                {calendarView === 'day' && new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseDateKey(selectedDate))}
              </h2>
              {isAwayFromToday && (
                <button
                  type="button"
                  onClick={goToToday}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#6B7480] transition hover:bg-slate-50"
                >
                  Today
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => calendarView === 'month' ? moveMonth(1) : calendarView === 'week' ? moveWeek(1) : moveDay(1)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#6B7480] transition hover:bg-slate-100 hover:text-[#30373E]"
            >
              {calendarView === 'month' && (
                <span className="hidden sm:inline capitalize">{monthLabel(new Date(activeMonth.getFullYear(), activeMonth.getMonth() + 1, 1))}</span>
              )}
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* --- Month view --- */}
          {calendarView === 'month' && (
            <>
              <div className="mt-4 grid grid-cols-7 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[#6B7480]">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div key={day} className="border-r border-slate-200 px-2 py-3 last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {monthDays.map((day) => {
                  const dayEvents = events.filter((event) => isDateInRange(day.key, event))
                  const isSelected = selectedDate === day.key

                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => chooseDate(day.key)}
                      onDoubleClick={() => startCreateFromDate(day.key)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => dropEvent(day.key)}
                      className={`min-h-32 border-b border-r border-slate-200 p-2 text-left transition hover:bg-[#2764FF]/10/60 ${
                        day.inMonth ? 'bg-white' : 'bg-slate-50 text-slate-300'
                      } ${isSelected ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                    >
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                          day.isToday ? 'bg-[#2764FF] text-white' : day.inMonth ? 'text-[#30373E]' : 'text-slate-300'
                        }`}
                      >
                        {day.date.getDate()}
                      </span>
                      <div className="mt-2 space-y-1">
                        {dayEvents.slice(0, 4).map((event) => {
                          const kind = getKindStyle(event.kind)
                          const isRangeStart = event.startDate === day.key
                          const isRangeEnd = event.endDate === day.key
                          return (
                            <div
                              key={event.id}
                              draggable
                              onClick={(click) => {
                                click.stopPropagation()
                                setDetailEventId(event.id)
                                setSelectedDate(day.key)
                              }}
                              onDragStart={() => setDraggedEventId(event.id)}
                              className={`truncate border px-2 py-1 text-xs font-semibold ${kind.chip} ${kind.border} ${
                                isRangeStart ? 'rounded-l-lg' : 'rounded-l-sm'
                              } ${isRangeEnd ? 'rounded-r-lg' : 'rounded-r-sm'} ${
                                event.impact === 'critical' ? 'ring-1 ring-red-300' : ''
                              }`}
                              title={`${event.title} · ${event.zone}`}
                            >
                              {event.startTime && isRangeStart ? `${event.startTime} ` : ''}
                              {event.title}
                            </div>
                          )
                        })}
                        {dayEvents.length > 4 && (
                          <p className="text-xs font-medium text-[#6B7480]">+{dayEvents.length - 4}</p>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* --- Week view --- */}
          {calendarView === 'week' && (() => {
            const weekHours = Array.from({ length: 16 }, (_, i) => i + 7)
            // Collect unique all-day events that overlap this week, with their column span
            const weekStart = weekDays[0].key
            const weekEnd = weekDays[6].key
            const allDaySpans = events
              .filter((event) => !event.startTime && event.startDate <= weekEnd && event.endDate >= weekStart)
              .map((event) => {
                const startCol = Math.max(0, weekDays.findIndex((wd) => wd.key >= event.startDate))
                const endCol = (() => {
                  const idx = weekDays.findIndex((wd) => wd.key >= event.endDate)
                  return idx === -1 ? 6 : (weekDays[idx].key === event.endDate ? idx : Math.max(0, idx - 1))
                })()
                return { event, startCol, endCol, span: endCol - startCol + 1 }
              })
            const hasAllDay = allDaySpans.length > 0

            return (
              <div className="mt-4 space-y-0">
                {/* Header */}
                <div className="grid grid-cols-[56px_repeat(7,1fr)] rounded-t-xl border border-b-0 border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase tracking-[0.16em] text-[#6B7480]">
                  <div className="border-r border-slate-200 px-1 py-3" />
                  {weekDays.map((wd) => (
                    <div key={wd.key} className={`border-r border-slate-200 px-1 py-3 last:border-r-0 ${wd.isToday ? 'bg-[#2764FF]/10 text-[#004bd9]' : ''}`}>
                      {new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(wd.date)} {wd.date.getDate()}
                    </div>
                  ))}
                </div>

                {/* All-day row */}
                {hasAllDay && (
                  <div className="relative border border-b-0 border-slate-200 bg-slate-50/60">
                    <div className="grid grid-cols-[56px_repeat(7,1fr)]">
                      <div className="flex items-start justify-end border-r border-slate-100 pr-2 pt-2">
                        <span className="text-[10px] font-medium text-[#6B7480]">All day</span>
                      </div>
                      <div className="col-span-7 space-y-0.5 py-1">
                        {allDaySpans.map(({ event, startCol, span }) => {
                          const kind = getKindStyle(event.kind)
                          // Calculate left/width as percentage of the 7-col area
                          const leftPct = (startCol / 7) * 100
                          const widthPct = (span / 7) * 100
                          return (
                            <div key={event.id} className="relative h-6" style={{ marginLeft: `${leftPct}%`, width: `${widthPct}%` }}>
                              <div
                                onClick={() => { setDetailEventId(event.id); setSelectedDate(event.startDate) }}
                                className={`absolute inset-0 mx-1 cursor-pointer truncate rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${kind.chip} ${kind.border}`}
                                title={event.title}
                              >
                                {event.title}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Hourly grid */}
                <div className="overflow-hidden rounded-b-xl border border-slate-200 bg-white">
                  {weekHours.map((hour) => {
                    const label = `${String(hour).padStart(2, '0')}:00`
                    return (
                      <div key={hour} className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-slate-100 last:border-b-0">
                        <div className="flex items-start justify-end border-r border-slate-100 pr-2 pt-1">
                          <span className="text-xs font-medium text-[#6B7480]">{label}</span>
                        </div>
                        {weekDays.map((wd) => {
                          const hourEvents = events.filter((event) => {
                            if (!isDateInRange(wd.key, event) || !event.startTime) return false
                            return Number(event.startTime.split(':')[0]) === hour
                          })
                          return (
                            <div
                              key={wd.key}
                              className={`min-h-10 border-r border-slate-100 px-1 py-0.5 last:border-r-0 transition hover:bg-[#2764FF]/10/40 cursor-pointer ${
                                selectedDate === wd.key ? 'bg-[#2764FF]/10/20' : ''
                              }`}
                              onClick={() => chooseDate(wd.key)}
                              onDoubleClick={() => {
                                setNaturalInput(`le ${formatDateFr(wd.key).replaceAll('-', '/')} de ${hour}h à ${hour + 1}h `)
                                startCreateFromDate(wd.key)
                              }}
                            >
                              {hourEvents.map((event) => {
                                const kind = getKindStyle(event.kind)
                                return (
                                  <div
                                    key={event.id}
                                    onClick={(e) => { e.stopPropagation(); setDetailEventId(event.id); setSelectedDate(wd.key) }}
                                    className={`mb-0.5 cursor-pointer truncate rounded border px-1.5 py-0.5 text-[11px] font-semibold ${kind.chip} ${kind.border}`}
                                    title={`${event.title} · ${event.startTime}${event.endTime ? `-${event.endTime}` : ''}`}
                                  >
                                    {event.startTime} {event.title}
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* --- Day view --- */}
          {calendarView === 'day' && (() => {
            const dayEvents = events
              .filter((event) => isDateInRange(selectedDate, event))
              .sort((a, b) => `${a.startTime}${a.title}`.localeCompare(`${b.startTime}${b.title}`))
            const allDayEvents = dayEvents.filter((event) => !event.startTime)
            const timedEvents = dayEvents.filter((event) => !!event.startTime)
            const hours = Array.from({ length: 16 }, (_, i) => i + 7) // 7h - 22h

            const eventsAtHour = (hour: number) =>
              timedEvents.filter((event) => {
                const h = Number(event.startTime.split(':')[0])
                return h === hour
              })

            return (
              <div className="mt-4 space-y-0">
                {allDayEvents.length > 0 && (
                  <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-[#6B7480]">All day</p>
                    <div className="space-y-1">
                      {allDayEvents.map((event) => {
                        const kind = getKindStyle(event.kind)
                        return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => setDetailEventId(event.id)}
                            className={`w-full rounded-lg border px-3 py-2 text-left transition hover:border-blue-200 ${kind.border} ${kind.chip} ${
                              selectedEventId === event.id ? 'ring-2 ring-blue-500' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${kind.color}`} />
                              <span className="text-sm font-semibold text-[#03182F] truncate">{event.title}</span>
                              <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${impactLabels[event.impact].chip}`}>
                                {impactLabels[event.impact].label}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {hours.map((hour) => {
                  const hourEvents = eventsAtHour(hour)
                  const label = `${String(hour).padStart(2, '0')}:00`

                  return (
                    <div
                      key={hour}
                      className="group flex border-b border-slate-100 last:border-b-0 transition hover:bg-[#2764FF]/10/40 cursor-pointer"
                      onDoubleClick={() => {
                        setNaturalInput(`le ${formatDateFr(selectedDate).replaceAll('-', '/')} de ${hour}h à ${hour + 1}h `)
                        startCreateFromDate(selectedDate)
                      }}
                    >
                      <div className="flex w-16 shrink-0 items-start justify-end border-r border-slate-100 pr-3 pt-2">
                        <span className="text-xs font-medium text-[#6B7480]">{label}</span>
                      </div>
                      <div className="min-h-14 flex-1 px-3 py-1.5">
                        {hourEvents.map((event) => {
                          const kind = getKindStyle(event.kind)
                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setDetailEventId(event.id) }}
                              className={`mb-1 w-full rounded-lg border px-3 py-2 text-left transition hover:border-blue-200 ${kind.border} ${kind.chip} ${
                                selectedEventId === event.id ? 'ring-2 ring-blue-500' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${kind.color}`} />
                                <span className="text-sm font-semibold text-[#03182F] truncate">{event.title}</span>
                                {event.startTime && (
                                  <span className="shrink-0 text-xs text-[#6B7480]">
                                    {event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}
                                  </span>
                                )}
                                <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${impactLabels[event.impact].chip}`}>
                                  {impactLabels[event.impact].label}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
                </div>
              </div>
            )
          })()}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
            {counts.map((kind) => (
              <div key={kind.value} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${kind.color}`} />
                <span className="font-serif text-[12px] text-[#6B7480]">{kind.label}</span>
              </div>
            ))}
          </div>
        </section>

      </div>

      {detailEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDetailEventId(null)}>
          <div className="w-full max-w-2xl rounded-xl bg-white border border-[#DDE5EE] p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`h-3.5 w-3.5 rounded-full ${getKindStyle(detailEvent.kind).color}`} />
                <h3 className="font-serif text-lg font-bold text-[#03182F]">{detailEvent.title}</h3>
              </div>
              <button type="button" onClick={() => setDetailEventId(null)} className="rounded-lg p-1.5 text-[#6B7480] hover:bg-slate-50 hover:text-[#03182F] transition">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 font-serif text-sm text-[#30373E]">
                <svg className="h-4 w-4 text-[#6B7480]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span>{formatDateRangeFr(detailEvent.startDate, detailEvent.endDate)}</span>
                {detailEvent.startTime && (
                  <span className="text-[#6B7480]">{detailEvent.startTime}{detailEvent.endTime ? ` - ${detailEvent.endTime}` : ''}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-1 font-serif text-[11px] font-bold ${getKindStyle(detailEvent.kind).chip}`}>{getKindStyle(detailEvent.kind).label}</span>
                <span className={`rounded-full px-2.5 py-1 font-serif text-[11px] font-bold ${impactLabels[detailEvent.impact].chip}`}>Impact {impactLabels[detailEvent.impact].label.toLowerCase()}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-serif text-[11px] font-bold text-[#30373E]">{detailEvent.zone}</span>
              </div>
              {detailEvent.notes && (
                <p className="rounded-lg bg-[#F2F8FF] border border-[#DDE5EE] px-3 py-2.5 font-serif text-[13px] leading-6 text-[#30373E]">{detailEvent.notes}</p>
              )}
            </div>

            <div className="mt-5 border-t border-[#DDE5EE] pt-4">
              <p className="font-serif text-[14px] font-bold text-[#03182F]">Chat with Leia</p>
              <p className="mt-1 font-serif text-[12px] text-[#6B7480]">
                Ask for operational actions specific to this event.
              </p>

              <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-[#DDE5EE] bg-slate-50 p-3">
                {eventChatMessages.length === 0 ? (
                  <p className="font-serif text-[12px] text-[#6B7480]">
                    Example: What should I secure 2 weeks before this event?
                  </p>
                ) : (
                  eventChatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-lg border px-3 py-2 ${
                        message.role === 'assistant'
                          ? 'border-[#DDE5EE] bg-white'
                          : 'border-[#BFCBDA] bg-[#F2F8FF]'
                      }`}
                    >
                      <p className="font-serif text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7480]">
                        {message.role === 'assistant' ? 'Leia' : 'You'}
                      </p>
                      <p className="mt-1 font-serif text-[13px] leading-6 text-[#03182F]">{message.content}</p>
                      {message.reasoningSummary && message.role === 'assistant' ? (
                        <p className="mt-2 rounded border border-[#DDE5EE] bg-[#F2F8FF] px-2.5 py-1.5 font-serif text-[12px] text-[#30373E]">
                          {message.reasoningSummary}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              {eventChatError && (
                <p className="mt-2 rounded-lg border border-[#ba1a1a]/30 bg-[#FFE7EC] px-3 py-2 font-serif text-[12px] text-[#ba1a1a]">
                  {eventChatError}
                </p>
              )}

              <form className="mt-3 flex gap-2" onSubmit={submitEventChat}>
                <input
                  type="text"
                  value={eventChatInput}
                  onChange={(event) => setEventChatInput(event.target.value)}
                  placeholder={`Ask Leia about "${detailEvent.title}"...`}
                  className="h-10 flex-1 rounded-lg border border-[#DDE5EE] px-3 font-serif text-[13px] text-[#03182F] outline-none focus:border-[#2764FF] focus:ring-1 focus:ring-[#2764FF]"
                />
                <button
                  type="submit"
                  disabled={eventChatSending || !eventChatInput.trim()}
                  className="h-10 rounded-lg bg-[#2764FF] px-4 font-serif text-[13px] font-bold text-white transition hover:bg-[#004bd9] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {eventChatSending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
