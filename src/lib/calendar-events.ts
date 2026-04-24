type CalendarEventDeleteCandidate = {
  id: string
  kind?: string
  locked?: boolean
}

type CalendarDisplayEvent = {
  title: string
  kind: string
  zone?: string | null
  notes?: string | null
}

const TITLE_TRANSLATIONS: Record<string, string> = {
  "jour de l an": "New Year's Day",
  "soldes d hiver": 'Winter sales',
  "saint valentin": "Valentine's Day",
  "nouvel an chinois": 'Chinese New Year',
  "ramadan aid el fitr": 'Ramadan + Eid al-Fitr',
  "lundi de paques": 'Easter Monday',
  "fete du travail": 'Labour Day',
  "victoire 1945": 'Victory in Europe Day',
  ascension: 'Ascension Day',
  "lundi de pentecote": 'Whit Monday',
  "fete des meres fete des peres": "Mother's Day / Father's Day",
  "vacances marie": 'Marie vacation',
  "fete nationale": 'Bastille Day',
  assomption: 'Assumption Day',
  "rentree back to school": 'Back to School',
  toussaint: "All Saints' Day",
  "singles day 11 11": "Singles' Day 11.11",
  "noel retours post noel": 'Christmas + post-holiday returns',
  noel: 'Christmas Day',
}

function decodeLegacyText(value: string) {
  return value
    .replace(/\u00c3\u00a9/g, 'e')
    .replace(/\u00c3\u00a8/g, 'e')
    .replace(/\u00c3\u00aa/g, 'e')
    .replace(/\u00c3\u00ab/g, 'e')
    .replace(/\u00c3\u00a0/g, 'a')
    .replace(/\u00c3\u00a2/g, 'a')
    .replace(/\u00c3\u00a7/g, 'c')
    .replace(/\u00c3\u00af/g, 'i')
    .replace(/\u00c3\u00ae/g, 'i')
    .replace(/\u00c3\u00b4/g, 'o')
    .replace(/\u00c3\u00b6/g, 'o')
    .replace(/\u00c3\u00b9/g, 'u')
    .replace(/\u00c3\u00bb/g, 'u')
    .replace(/\u00c3\u00bc/g, 'u')
    .replace(/\u00c2\u00b7/g, '-')
    .replace(/\u00e2\u20ac[\u201d\u201c]/g, '-')
}

function lookupKey(value?: string | null) {
  return decodeLegacyText(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function titleCaseName(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value
}

function translateTitle(title: string) {
  const key = lookupKey(title)
  return TITLE_TRANSLATIONS[key] || decodeLegacyText(title)
}

function normalizeDisplayKind(kind: string, title: string) {
  const normalizedKind = lookupKey(kind)
  const titleKey = lookupKey(title)

  if (normalizedKind === 'leave') return 'leave'
  if (normalizedKind === 'holiday') return 'holiday'
  if (normalizedKind === 'celebration') return 'celebration'
  if (normalizedKind === 'peak') return 'peak'

  if (
    titleKey.includes('valentin') ||
    titleKey.includes('ramadan') ||
    titleKey.includes('aid') ||
    titleKey.includes('chinese') ||
    titleKey.includes('chinois') ||
    titleKey.includes('mother') ||
    titleKey.includes('father') ||
    titleKey.includes('meres') ||
    titleKey.includes('peres')
  ) {
    return 'celebration'
  }

  if (normalizedKind === 'commerce' || normalizedKind === 'marketing' || normalizedKind === 'logistics') {
    return 'peak'
  }

  return normalizedKind || kind
}

function translateZone(zone?: string | null) {
  const key = lookupKey(zone)
  if (key === 'chine sourcing international') return 'China / international sourcing'
  if (key === 'chine marketplaces') return 'China / marketplaces'
  return decodeLegacyText(zone || '')
}

function translateNotes(notes: string | null | undefined, title: string) {
  const text = decodeLegacyText(notes || '').trim()
  if (!text) return ''

  const titleKey = lookupKey(title)
  const noteKey = lookupKey(text)
  const leaveRange = noteKey.match(/conges de ([a-z]+) du (\d{4} \d{2} \d{2}) au (\d{4} \d{2} \d{2})/)
  if (leaveRange) {
    return `${titleCaseName(leaveRange[1])} time off from ${leaveRange[2].replaceAll(' ', '-')} to ${leaveRange[3].replaceAll(' ', '-')}.`
  }
  if (noteKey.includes('conges valides par marie')) return 'Time off approved by Marie.'
  if (noteKey.includes('jour ferie')) {
    return 'Public holiday: expect closures, carrier delays and spikes before/after.'
  }
  if (titleKey.includes('soldes')) {
    return 'Prepare promotions, stock, pricing, customer support and logistics capacity over 4 weeks.'
  }
  if (titleKey.includes('valentin')) {
    return 'Gift peak, time-boxed offers and strict on-time delivery expectations.'
  }
  if (titleKey.includes('chinois') || titleKey.includes('chinese')) {
    return 'Plan ahead for supplier closures, production delays, transport booking and import stockouts.'
  }
  if (titleKey.includes('ramadan') || titleKey.includes('aid')) {
    return 'Adapt assortment, campaigns, operational hours and demand forecasts by market.'
  }
  if (titleKey.includes('meres') || titleKey.includes('peres') || titleKey.includes('mother') || titleKey.includes('father')) {
    return 'Gift window: leverage targeted campaigns, bundles and guaranteed delivery SLAs.'
  }
  if (titleKey.includes('rentree') || titleKey.includes('back to school')) {
    return 'Prepare campaigns, seasonal stock and demand surge from late August to early September.'
  }
  if (titleKey.includes('singles day')) {
    return 'Major e-commerce promotional peak: useful for marketplace monitoring and cross-border operations.'
  }
  if (titleKey.includes('black friday')) {
    return 'Traffic peak, aggressive promotions, stock tension and reinforced customer support.'
  }
  if (titleKey.includes('noel') || titleKey.includes('christmas')) {
    return 'Gift peak, shipping constraints, then expected surge in returns and exchanges.'
  }

  if (/(conges|ferie|preparer|capacite|delais|aout|marche|retours|echanges|transporteurs)/.test(noteKey)) {
    return 'Operational note recorded for this event.'
  }

  return text
}

export function normalizeCalendarDisplayEvent<T extends CalendarDisplayEvent>(event: T): T {
  const title = translateTitle(event.title)
  return {
    ...event,
    title,
    kind: normalizeDisplayKind(event.kind, event.title),
    zone: translateZone(event.zone),
    notes: translateNotes(event.notes, event.title),
  }
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
