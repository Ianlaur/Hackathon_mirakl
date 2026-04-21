'use client'

import { FormEvent, useMemo, useState } from 'react'

type EventKind = 'commerce' | 'holiday' | 'leave' | 'logistics' | 'marketing' | 'internal'
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

const eventKinds: Record<EventKind, { label: string; color: string; chip: string; border: string }> = {
  commerce: {
    label: 'Commerce',
    color: 'bg-fuchsia-600',
    chip: 'bg-fuchsia-50 text-fuchsia-800',
    border: 'border-fuchsia-200',
  },
  holiday: {
    label: 'Jour férié',
    color: 'bg-slate-500',
    chip: 'bg-slate-100 text-slate-700',
    border: 'border-slate-200',
  },
  leave: {
    label: 'Congés',
    color: 'bg-sky-600',
    chip: 'bg-sky-50 text-sky-800',
    border: 'border-sky-200',
  },
  logistics: {
    label: 'Logistique',
    color: 'bg-emerald-600',
    chip: 'bg-emerald-50 text-emerald-800',
    border: 'border-emerald-200',
  },
  marketing: {
    label: 'Marketing',
    color: 'bg-orange-500',
    chip: 'bg-orange-50 text-orange-800',
    border: 'border-orange-200',
  },
  internal: {
    label: 'Interne',
    color: 'bg-blue-600',
    chip: 'bg-blue-50 text-blue-800',
    border: 'border-blue-200',
  },
}

const impactLabels: Record<EventImpact, { label: string; chip: string }> = {
  low: { label: 'Faible', chip: 'bg-slate-100 text-slate-600' },
  medium: { label: 'Moyen', chip: 'bg-amber-50 text-amber-700' },
  high: { label: 'Fort', chip: 'bg-orange-50 text-orange-700' },
  critical: { label: 'Critique', chip: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
}

const today = new Date()
const todayKey = toDateKey(today)

const initialEvents: CalendarEvent[] = [
  {
    id: 'commerce-fr-holidays-2026',
    title: 'Jours fériés France 2026',
    startDate: '2026-01-01',
    endDate: '2026-12-25',
    startTime: '',
    endTime: '',
    kind: 'holiday',
    impact: 'medium',
    zone: 'France',
    notes:
      'Repères annuels pour anticiper les fermetures, retards transporteurs et pics avant/après jours fériés.',
    locked: true,
  },
  {
    id: 'commerce-winter-sales-2026',
    title: "Soldes d'hiver",
    startDate: '2026-01-07',
    endDate: '2026-02-03',
    startTime: '08:00',
    endTime: '',
    kind: 'commerce',
    impact: 'high',
    zone: 'France / e-commerce',
    notes: 'Préparer promotions, stocks, pricing, SAV et capacité logistique sur 4 semaines.',
    locked: true,
  },
  {
    id: 'commerce-black-friday-2026',
    title: 'Black Friday / Cyber Monday',
    startDate: '2026-11-27',
    endDate: '2026-11-30',
    startTime: '',
    endTime: '',
    kind: 'commerce',
    impact: 'critical',
    zone: 'International',
    notes: 'Pic de trafic, promotions agressives, tension stock et support client renforcé.',
    locked: true,
  },
  {
    id: 'commerce-christmas-returns-2026',
    title: 'Noël + retours post-Noël',
    startDate: '2026-12-01',
    endDate: '2027-01-10',
    startTime: '',
    endTime: '',
    kind: 'commerce',
    impact: 'critical',
    zone: 'France / Europe',
    notes: 'Pic cadeaux, contraintes transport, puis hausse attendue des retours et échanges.',
    locked: true,
  },
  {
    id: 'commerce-chinese-new-year-2026',
    title: 'Nouvel An chinois',
    startDate: '2026-02-17',
    endDate: '2026-02-24',
    startTime: '',
    endTime: '',
    kind: 'logistics',
    impact: 'critical',
    zone: 'Chine / sourcing international',
    notes: 'Anticiper fermetures fournisseurs, délais de production, booking transport et ruptures import.',
    locked: true,
  },
  {
    id: 'commerce-ramadan-eid-2026',
    title: 'Ramadan + Aïd el-Fitr',
    startDate: '2026-02-18',
    endDate: '2026-03-20',
    startTime: '',
    endTime: '',
    kind: 'commerce',
    impact: 'high',
    zone: 'International',
    notes: 'Adapter assortiment, campagnes, horaires opérationnels et prévisions de demande selon marchés.',
    locked: true,
  },
  {
    id: 'commerce-singles-day-2026',
    title: "Singles' Day 11.11",
    startDate: '2026-11-11',
    endDate: '2026-11-11',
    startTime: '',
    endTime: '',
    kind: 'commerce',
    impact: 'high',
    zone: 'Chine / marketplaces',
    notes: 'Grand temps fort promotionnel e-commerce, utile pour veille marketplace et opérations cross-border.',
    locked: true,
  },
  {
    id: 'commerce-back-to-school-2026',
    title: 'Rentrée / Back to School',
    startDate: '2026-08-24',
    endDate: '2026-09-06',
    startTime: '',
    endTime: '',
    kind: 'marketing',
    impact: 'medium',
    zone: 'France / Europe',
    notes: 'Préparer campagnes, stocks saisonniers et hausse de demande de fin août à début septembre.',
    locked: true,
  },
  {
    id: 'commerce-parents-days-2026',
    title: 'Fête des Mères / Fête des Pères',
    startDate: '2026-05-31',
    endDate: '2026-06-21',
    startTime: '',
    endTime: '',
    kind: 'marketing',
    impact: 'medium',
    zone: 'France',
    notes: 'Période cadeaux à exploiter avec campagnes ciblées, bundles et délais de livraison garantis.',
    locked: true,
  },
  {
    id: 'commerce-valentine-2026',
    title: 'Saint-Valentin',
    startDate: '2026-02-14',
    endDate: '2026-02-14',
    startTime: '',
    endTime: '',
    kind: 'marketing',
    impact: 'medium',
    zone: 'International',
    notes: 'Temps fort cadeaux, offres limitées et livraison avant date à surveiller.',
    locked: true,
  },
]

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date)
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
  const [activeMonth, setActiveMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [selectedEventId, setSelectedEventId] = useState<string | null>('commerce-chinese-new-year-2026')
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null)
  const [form, setForm] = useState<EventForm>(emptyForm)

  const monthDays = useMemo(() => buildMonthDays(activeMonth), [activeMonth])
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId]
  )
  const selectedDateEvents = events
    .filter((event) => isDateInRange(selectedDate, event))
    .sort((a, b) => `${a.startDate}${a.startTime}${a.title}`.localeCompare(`${b.startDate}${b.startTime}${b.title}`))

  const counts = Object.entries(eventKinds).map(([value, kind]) => ({
    value: value as EventKind,
    ...kind,
    count: events.filter((event) => event.kind === value).length,
  }))

  const createEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const startDate = form.startDate
    const endDate = form.endDate && form.endDate >= startDate ? form.endDate : startDate
    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      ...form,
      title: form.title.trim(),
      startDate,
      endDate,
      notes: form.notes.trim(),
    }
    setEvents((current) => [...current, newEvent])
    setSelectedDate(newEvent.startDate)
    setSelectedEventId(newEvent.id)
    setForm(emptyForm)
  }

  const updateSelectedEvent = (patch: Partial<CalendarEvent>) => {
    if (!selectedEvent) return
    setEvents((current) =>
      current.map((event) => {
        if (event.id !== selectedEvent.id) return event
        const next = { ...event, ...patch }
        if (next.endDate < next.startDate) {
          next.endDate = next.startDate
        }
        return next
      })
    )
  }

  const moveMonth = (offset: number) => {
    setActiveMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const chooseDate = (dateKey: string) => {
    setSelectedDate(dateKey)
    setForm((current) => ({ ...current, startDate: dateKey, endDate: dateKey }))
  }

  const dropEvent = (dateKey: string) => {
    if (!draggedEventId) return
    setEvents((current) =>
      current.map((event) => {
        if (event.id !== draggedEventId) return event
        const duration = daysBetween(event.startDate, event.endDate)
        return { ...event, startDate: dateKey, endDate: addDays(dateKey, duration) }
      })
    )
    setSelectedDate(dateKey)
    setSelectedEventId(draggedEventId)
    setDraggedEventId(null)
  }

  const deleteSelectedEvent = () => {
    if (!selectedEvent) return
    setEvents((current) => current.filter((event) => event.id !== selectedEvent.id))
    setSelectedEventId(null)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="dashboard-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-700">Planning opérationnel</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Calendrier</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Suivez les congés, jours fériés et temps forts commerce qui peuvent impacter vos ventes, stocks et
              livraisons.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {counts.map((kind) => (
              <div key={kind.value} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${kind.color}`} />
                  <span className="text-xs font-medium text-slate-500">{kind.label}</span>
                </div>
                <p className="mt-1 text-xl font-semibold text-slate-950">{kind.count}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="dashboard-card overflow-hidden p-4 sm:p-5">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Vue mensuelle</p>
              <h2 className="mt-1 text-2xl font-semibold capitalize text-slate-950">{monthLabel(activeMonth)}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Précédent
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMonth(new Date(today.getFullYear(), today.getMonth(), 1))
                  chooseDate(todayKey)
                }}
                className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Aujourd&apos;hui
              </button>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Suivant
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-7 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
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
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropEvent(day.key)}
                  className={`min-h-32 border-b border-r border-slate-200 p-2 text-left transition hover:bg-blue-50/60 ${
                    day.inMonth ? 'bg-white' : 'bg-slate-50 text-slate-300'
                  } ${isSelected ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                >
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                      day.isToday ? 'bg-blue-600 text-white' : day.inMonth ? 'text-slate-700' : 'text-slate-300'
                    }`}
                  >
                    {day.date.getDate()}
                  </span>
                  <div className="mt-2 space-y-1">
                    {dayEvents.slice(0, 4).map((event) => {
                      const kind = eventKinds[event.kind]
                      const isRangeStart = event.startDate === day.key
                      const isRangeEnd = event.endDate === day.key
                      return (
                        <div
                          key={event.id}
                          draggable
                          onClick={(click) => {
                            click.stopPropagation()
                            setSelectedEventId(event.id)
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
                      <p className="text-xs font-medium text-slate-400">+{dayEvents.length - 4}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="dashboard-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Nouvel événement</h2>
            <form onSubmit={createEvent} className="mt-4 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Titre</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                  placeholder="Congés, fermeture, campagne..."
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Type</span>
                  <select
                    value={form.kind}
                    onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as EventKind }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                  >
                    {Object.entries(eventKinds).map(([value, kind]) => (
                      <option key={value} value={value}>
                        {kind.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Impact</span>
                  <select
                    value={form.impact}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, impact: event.target.value as EventImpact }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                  >
                    {Object.entries(impactLabels).map(([value, impact]) => (
                      <option key={value} value={value}>
                        {impact.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Début</span>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, startDate: event.target.value, endDate: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Fin</span>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                    required
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Heure début</span>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Heure fin</span>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Zone</span>
                <input
                  value={form.zone}
                  onChange={(event) => setForm((current) => ({ ...current, zone: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                  placeholder="France, Chine, Interne..."
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                  placeholder="Contexte, recommandation, action à anticiper..."
                />
              </label>

              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Ajouter
              </button>
            </form>
          </section>

          <section className="dashboard-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Détails / édition</h2>
            {selectedEvent ? (
              <div className="mt-4 space-y-3">
                <input
                  value={selectedEvent.title}
                  onChange={(event) => updateSelectedEvent({ title: event.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none ring-blue-500 transition focus:ring-2"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={selectedEvent.startDate}
                    onChange={(event) => updateSelectedEvent({ startDate: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                  />
                  <input
                    type="date"
                    value={selectedEvent.endDate}
                    onChange={(event) => updateSelectedEvent({ endDate: event.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${eventKinds[selectedEvent.kind].chip}`}>
                    {eventKinds[selectedEvent.kind].label}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${impactLabels[selectedEvent.impact].chip}`}>
                    Impact {impactLabels[selectedEvent.impact].label.toLowerCase()}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {selectedEvent.zone}
                  </span>
                </div>
                <textarea
                  value={selectedEvent.notes}
                  onChange={(event) => updateSelectedEvent({ notes: event.target.value })}
                  className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 outline-none ring-blue-500 transition focus:ring-2"
                />
                <button
                  type="button"
                  onClick={deleteSelectedEvent}
                  className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                >
                  Supprimer
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-500">Cliquez sur un événement pour voir ses détails.</p>
            )}
          </section>

          <section className="dashboard-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">{selectedDate}</h2>
            <div className="mt-3 space-y-2">
              {selectedDateEvents.length > 0 ? (
                selectedDateEvents.map((event) => {
                  const kind = eventKinds[event.kind]
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedEventId(event.id)}
                      className={`w-full rounded-xl border bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50 ${kind.border}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${kind.color}`} />
                          <span className="text-xs font-semibold text-slate-500">
                            {event.startDate === event.endDate ? event.startDate : `${event.startDate} - ${event.endDate}`}
                          </span>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${impactLabels[event.impact].chip}`}>
                          {impactLabels[event.impact].label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{event.title}</p>
                    </button>
                  )
                })
              ) : (
                <p className="text-sm text-slate-500">Aucun événement sur cette date.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
