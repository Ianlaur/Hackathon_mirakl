'use client'

import { FormEvent, useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'

type CalendarEvent = EventInput & {
  id: string
  title: string
  start: string
  end?: string
  backgroundColor?: string
  borderColor?: string
  extendedProps?: {
    kind: string
    notes?: string
  }
}

const eventKinds = [
  { value: 'transport', label: 'Transport', color: '#f97316' },
  { value: 'stock', label: 'Stock', color: '#2563eb' },
  { value: 'wms', label: 'Entrepôt', color: '#059669' },
  { value: 'client', label: 'Client', color: '#7c3aed' },
]

const initialEvents: CalendarEvent[] = [
  {
    id: 'evt-transport-1',
    title: 'Réception transporteur',
    start: new Date().toISOString().slice(0, 10),
    backgroundColor: '#f97316',
    borderColor: '#f97316',
    extendedProps: { kind: 'transport', notes: 'Contrôler les colis entrants.' },
  },
  {
    id: 'evt-stock-1',
    title: 'Audit stock bas',
    start: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
    extendedProps: { kind: 'stock', notes: 'Prioriser les produits sous seuil.' },
  },
  {
    id: 'evt-wms-1',
    title: 'Préparation picking',
    start: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) + 'T10:00:00',
    end: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) + 'T12:00:00',
    backgroundColor: '#059669',
    borderColor: '#059669',
    extendedProps: { kind: 'wms', notes: 'Planifier les emplacements prioritaires.' },
  },
]

function toDatetimeLocal(value: Date) {
  const offset = value.getTimezoneOffset() * 60000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}

export default function CalendarPageClient() {
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialEvents[0]?.id || null)
  const [form, setForm] = useState({
    title: '',
    kind: 'transport',
    start: toDatetimeLocal(new Date()),
    end: '',
    notes: '',
  })

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId]
  )

  const counts = useMemo(
    () =>
      eventKinds.map((kind) => ({
        ...kind,
        count: events.filter((event) => event.extendedProps?.kind === kind.value).length,
      })),
    [events]
  )

  const createEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const kind = eventKinds.find((item) => item.value === form.kind) || eventKinds[0]
    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: form.title.trim(),
      start: form.start,
      end: form.end || undefined,
      backgroundColor: kind.color,
      borderColor: kind.color,
      extendedProps: {
        kind: kind.value,
        notes: form.notes.trim() || undefined,
      },
    }

    setEvents((current) => [...current, newEvent])
    setSelectedEventId(newEvent.id)
    setForm((current) => ({ ...current, title: '', notes: '' }))
  }

  const createFromSelection = (selection: DateSelectArg) => {
    const kind = eventKinds[0]
    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: 'Nouvel événement',
      start: selection.startStr,
      end: selection.endStr,
      backgroundColor: kind.color,
      borderColor: kind.color,
      extendedProps: { kind: kind.value },
    }

    setEvents((current) => [...current, newEvent])
    setSelectedEventId(newEvent.id)
    selection.view.calendar.unselect()
  }

  const updateEventDates = (id: string, start: Date | null, end: Date | null) => {
    setEvents((current) =>
      current.map((event) =>
        event.id === id
          ? {
              ...event,
              start: start?.toISOString() || event.start,
              end: end?.toISOString() || undefined,
            }
          : event
      )
    )
  }

  const handleEventClick = (click: EventClickArg) => {
    setSelectedEventId(click.event.id)
  }

  const handleDrop = (drop: EventDropArg) => {
    updateEventDates(drop.event.id, drop.event.start, drop.event.end)
  }

  const handleResize = (resize: EventResizeDoneArg) => {
    updateEventDates(resize.event.id, resize.event.start, resize.event.end)
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
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: kind.color }} />
                  <span className="text-xs font-medium text-slate-500">{kind.label}</span>
                </div>
                <p className="mt-1 text-xl font-semibold text-slate-950">{kind.count}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <section className="dashboard-card calendar-shell overflow-hidden p-3 sm:p-5">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            }}
            buttonText={{
              today: "Aujourd'hui",
              month: 'Mois',
              week: 'Semaine',
              day: 'Jour',
              list: 'Liste',
            }}
            locale="fr"
            height="auto"
            firstDay={1}
            selectable
            editable
            nowIndicator
            dayMaxEvents={3}
            events={events}
            select={createFromSelection}
            eventClick={handleEventClick}
            eventDrop={handleDrop}
            eventResize={handleResize}
          />
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

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Début</span>
                <input
                  type="datetime-local"
                  value={form.start}
                  onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-blue-500 transition focus:ring-2"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Fin</span>
                <input
                  type="datetime-local"
                  value={form.end}
                  onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))}
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
                    {eventKinds.find((kind) => kind.value === selectedEvent.extendedProps?.kind)?.label || 'Événement'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <p>{String(selectedEvent.start).replace('T', ' ').slice(0, 16)}</p>
                  {selectedEvent.end && <p>{String(selectedEvent.end).replace('T', ' ').slice(0, 16)}</p>}
                  {selectedEvent.extendedProps?.notes && <p className="mt-2">{selectedEvent.extendedProps.notes}</p>}
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
        </aside>
      </div>
    </div>
  )
}
