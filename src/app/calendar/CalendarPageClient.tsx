'use client'

import { FormEvent, useMemo, useState } from 'react'

type CalendarEvent = {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  kind: string
  notes: string
}

const eventKinds = [
  { value: 'transport', label: 'Transport', color: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700' },
  { value: 'stock', label: 'Stock', color: 'bg-blue-600', chip: 'bg-blue-50 text-blue-700' },
  { value: 'wms', label: 'Entrepôt', color: 'bg-emerald-600', chip: 'bg-emerald-50 text-emerald-700' },
  { value: 'client', label: 'Client', color: 'bg-violet-600', chip: 'bg-violet-50 text-violet-700' },
]

const today = new Date()
const todayKey = toDateKey(today)

const initialEvents: CalendarEvent[] = [
  {
    id: 'evt-transport-1',
    title: 'Réception transporteur',
    date: todayKey,
    startTime: '09:00',
    endTime: '10:00',
    kind: 'transport',
    notes: 'Contrôler les colis entrants.',
  },
  {
    id: 'evt-stock-1',
    title: 'Audit stock bas',
    date: addDays(today, 1),
    startTime: '14:00',
    endTime: '15:30',
    kind: 'stock',
    notes: 'Prioriser les produits sous seuil.',
  },
  {
    id: 'evt-wms-1',
    title: 'Préparation picking',
    date: addDays(today, 2),
    startTime: '10:00',
    endTime: '12:00',
    kind: 'wms',
    notes: 'Planifier les emplacements prioritaires.',
  },
]

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return toDateKey(next)
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

export default function CalendarPageClient() {
  const [activeMonth, setActiveMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEvents[0]?.id || null)
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    kind: 'transport',
    date: todayKey,
    startTime: '09:00',
    endTime: '10:00',
    notes: '',
  })

  const monthDays = useMemo(() => buildMonthDays(activeMonth), [activeMonth])
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId]
  )
  const selectedDateEvents = events
    .filter((event) => event.date === selectedDate)
    .sort((a, b) => `${a.startTime}${a.title}`.localeCompare(`${b.startTime}${b.title}`))

  const counts = eventKinds.map((kind) => ({
    ...kind,
    count: events.filter((event) => event.kind === kind.value).length,
  }))

  const createEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      ...form,
      title: form.title.trim(),
      notes: form.notes.trim(),
    }
    setEvents((current) => [...current, newEvent])
    setSelectedDate(newEvent.date)
    setSelectedEventId(newEvent.id)
    setForm((current) => ({ ...current, title: '', notes: '' }))
  }

  const moveMonth = (offset: number) => {
    setActiveMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const chooseDate = (dateKey: string) => {
    setSelectedDate(dateKey)
    setForm((current) => ({ ...current, date: dateKey }))
  }

  const dropEvent = (dateKey: string) => {
    if (!draggedEventId) return
    setEvents((current) =>
      current.map((event) => (event.id === draggedEventId ? { ...event, date: dateKey } : event))
    )
    setSelectedDate(dateKey)
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
              Planifiez les réceptions, tâches d&apos;entrepôt, relances client et opérations de stock.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
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
              const dayEvents = events.filter((event) => event.date === day.key)
              const isSelected = selectedDate === day.key

              return (
                <button
                  key={day.key}
                  type="button"
                  onClick={() => chooseDate(day.key)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropEvent(day.key)}
                  className={`min-h-28 border-b border-r border-slate-200 p-2 text-left transition hover:bg-blue-50/60 ${
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
                    {dayEvents.slice(0, 3).map((event) => {
                      const kind = eventKinds.find((item) => item.value === event.kind) || eventKinds[0]
                      return (
                        <div
                          key={event.id}
                          draggable
                          onClick={(click) => {
                            click.stopPropagation()
                            setSelectedEventId(event.id)
                            setSelectedDate(event.date)
                          }}
                          onDragStart={() => setDraggedEventId(event.id)}
                          className={`truncate rounded-lg px-2 py-1 text-xs font-semibold ${kind.chip}`}
                          title={`${event.startTime} ${event.title}`}
                        >
                          {event.startTime} {event.title}
                        </div>
                      )
                    })}
                    {dayEvents.length > 3 && <p className="text-xs font-medium text-slate-400">+{dayEvents.length - 3}</p>}
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
                  placeholder="Réunion transport"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Type</span>
                <select
                  value={form.kind}
                  onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                >
                  {eventKinds.map((kind) => (
                    <option key={kind.value} value={kind.value}>
                      {kind.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Date</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Début</span>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Fin</span>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                  placeholder="Contexte, priorité, personne assignée..."
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
            <h2 className="text-lg font-semibold text-slate-950">Sélection</h2>
            {selectedEvent ? (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{selectedEvent.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {eventKinds.find((kind) => kind.value === selectedEvent.kind)?.label || 'Événement'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <p>
                    {selectedEvent.date} · {selectedEvent.startTime}
                    {selectedEvent.endTime ? `-${selectedEvent.endTime}` : ''}
                  </p>
                  {selectedEvent.notes && <p className="mt-2">{selectedEvent.notes}</p>}
                </div>
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
                  const kind = eventKinds.find((item) => item.value === event.kind) || eventKinds[0]
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedEventId(event.id)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${kind.color}`} />
                        <span className="text-xs font-semibold text-slate-500">{event.startTime}</span>
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
