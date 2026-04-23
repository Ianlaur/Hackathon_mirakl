'use client'

import { FormEvent, useState } from 'react'

type EventItem = {
  id: string
  title: string
  event_type: string
  start_date: string
  end_date: string
  impact_level: string
  notes: string | null
}

type SignalItem = {
  id: string
  title: string
  summary: string
  source_name: string | null
  signal_type: string
  impact_level: string
  relevance_score: number
  geography: string | null
  tags: string[]
  recommendation: { id: string; title: string; status: string } | null
}

type RecommendationItem = {
  id: string
  title: string
  scenario_type: string
  status: string
  expected_impact: string | null
  created_at: string
}

function statusTone(status: string) {
  if (status === 'approved') return 'bg-[#3FA46A]/10 text-emerald-700'
  if (status === 'rejected') return 'bg-rose-50 text-rose-700'
  return 'bg-[#E0A93A]/10 text-amber-700'
}

export default function PlanningPageClient({
  events: initialEvents,
  signals: initialSignals,
  recommendations: initialRecommendations,
}: {
  events: EventItem[]
  signals: SignalItem[]
  recommendations: RecommendationItem[]
}) {
  const [events, setEvents] = useState(initialEvents)
  const [signals, setSignals] = useState(initialSignals)
  const [recommendations, setRecommendations] = useState(initialRecommendations)
  const [calendarForm, setCalendarForm] = useState({
    title: '',
    eventType: 'vacation',
    startDate: '',
    endDate: '',
    impactLevel: 'medium',
    notes: '',
  })
  const [signalForm, setSignalForm] = useState({
    title: '',
    summary: '',
    sourceName: 'n8n workflow',
    sourceUrl: '',
    signalType: 'news',
    impactLevel: 'medium',
    relevanceScore: '75',
    geography: '',
    tags: '',
  })
  const [savingEvent, setSavingEvent] = useState(false)
  const [savingSignal, setSavingSignal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreateEvent(event: FormEvent) {
    event.preventDefault()
    setSavingEvent(true)
    setError(null)

    try {
      const response = await fetch('/api/planning/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calendarForm),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create calendar event')
      }

      setEvents((current) => [
        {
          ...data.event,
          start_date: data.event.start_date,
          end_date: data.event.end_date,
        },
        ...current,
      ])

      if (data.recommendation) {
        setRecommendations((current) => [
          {
            ...data.recommendation,
            created_at: data.recommendation.created_at,
          },
          ...current,
        ])
      }

      setCalendarForm({
        title: '',
        eventType: 'vacation',
        startDate: '',
        endDate: '',
        impactLevel: 'medium',
        notes: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSavingEvent(false)
    }
  }

  async function handleCreateSignal(event: FormEvent) {
    event.preventDefault()
    setSavingSignal(true)
    setError(null)

    try {
      const response = await fetch('/api/planning/signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...signalForm,
          relevanceScore: Number(signalForm.relevanceScore),
          tags: signalForm.tags
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create context signal')
      }

      setSignals((current) => [
        {
          ...data.signal,
          recommendation: data.recommendation
            ? {
                id: data.recommendation.id,
                title: data.recommendation.title,
                status: data.recommendation.status,
              }
            : null,
        },
        ...current,
      ])

      if (data.recommendation) {
        setRecommendations((current) => [
          {
            ...data.recommendation,
            created_at: data.recommendation.created_at,
          },
          ...current,
        ])
      }

      setSignalForm({
        title: '',
        summary: '',
        sourceName: 'n8n workflow',
        sourceUrl: '',
        signalType: 'news',
        impactLevel: 'medium',
        relevanceScore: '75',
        geography: '',
        tags: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSavingSignal(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="dashboard-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.8fr] lg:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-amber-200 bg-[#E0A93A]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
              Planning & Context
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-[#03182F]">
              Calendar-aware planning with external context signals
            </h1>
            <p className="max-w-3xl text-base leading-7 text-[#6B7480]">
              Track merchant availability, ingest n8n context signals, and turn relevant events into approval-ready planning recommendations.
            </p>
          </div>

          <div className="rounded-lg bg-slate-950 p-5 text-white">
            <p className="text-sm uppercase tracking-[0.2em] text-[#6B7480]">How this works</p>
            <div className="mt-5 space-y-2 text-sm text-slate-300">
              <p>1. Add business events such as vacations or blackout periods.</p>
              <p>2. Push external news or demand signals through n8n.</p>
              <p>3. Review the resulting approval-ready planning recommendations.</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr_1.1fr]">
        <div className="dashboard-card p-5">
          <h2 className="text-lg font-semibold text-[#03182F]">Calendar events</h2>
          <form onSubmit={handleCreateEvent} className="mt-4 space-y-3">
            <input
              value={calendarForm.title}
              onChange={(event) => setCalendarForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Summer vacation, inventory count, holiday closure"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={calendarForm.eventType}
                onChange={(event) => setCalendarForm((current) => ({ ...current, eventType: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="vacation">Vacation</option>
                <option value="absence">Absence</option>
                <option value="blackout">Blackout</option>
                <option value="campaign">Campaign</option>
                <option value="holiday">Holiday</option>
              </select>
              <select
                value={calendarForm.impactLevel}
                onChange={(event) => setCalendarForm((current) => ({ ...current, impactLevel: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="low">Low impact</option>
                <option value="medium">Medium impact</option>
                <option value="high">High impact</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="date"
                value={calendarForm.startDate}
                onChange={(event) => setCalendarForm((current) => ({ ...current, startDate: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                type="date"
                value={calendarForm.endDate}
                onChange={(event) => setCalendarForm((current) => ({ ...current, endDate: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
            <textarea
              rows={3}
              value={calendarForm.notes}
              onChange={(event) => setCalendarForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Notes for operations planning"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={savingEvent}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {savingEvent ? 'Saving...' : 'Add calendar event'}
            </button>
          </form>

          <div className="mt-5 space-y-3">
            {events.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#03182F]">{item.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#6B7480]">{item.event_type}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-[#6B7480]">
                    {item.impact_level}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#6B7480]">
                  {item.start_date.slice(0, 10)} to {item.end_date.slice(0, 10)}
                </p>
                {item.notes ? <p className="mt-2 text-sm text-[#6B7480]">{item.notes}</p> : null}
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-card p-5">
          <h2 className="text-lg font-semibold text-[#03182F]">External context signals</h2>
          <form onSubmit={handleCreateSignal} className="mt-4 space-y-3">
            <input
              value={signalForm.title}
              onChange={(event) => setSignalForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Port strike risk, major event demand spike, supplier disruption"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <textarea
              rows={4}
              value={signalForm.summary}
              onChange={(event) => setSignalForm((current) => ({ ...current, summary: event.target.value }))}
              placeholder="Signal summary from n8n or manual review"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={signalForm.sourceName}
                onChange={(event) => setSignalForm((current) => ({ ...current, sourceName: event.target.value }))}
                placeholder="Source name"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                value={signalForm.sourceUrl}
                onChange={(event) => setSignalForm((current) => ({ ...current, sourceUrl: event.target.value }))}
                placeholder="https://source.example"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={signalForm.signalType}
                onChange={(event) => setSignalForm((current) => ({ ...current, signalType: event.target.value }))}
                placeholder="news"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
              <input
                value={signalForm.geography}
                onChange={(event) => setSignalForm((current) => ({ ...current, geography: event.target.value }))}
                placeholder="FR, EU, supplier region"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={signalForm.impactLevel}
                onChange={(event) => setSignalForm((current) => ({ ...current, impactLevel: event.target.value }))}
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              >
                <option value="low">Low impact</option>
                <option value="medium">Medium impact</option>
                <option value="high">High impact</option>
                <option value="critical">Critical impact</option>
              </select>
              <input
                type="number"
                min="0"
                max="100"
                value={signalForm.relevanceScore}
                onChange={(event) => setSignalForm((current) => ({ ...current, relevanceScore: event.target.value }))}
                placeholder="Relevance"
                className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </div>
            <input
              value={signalForm.tags}
              onChange={(event) => setSignalForm((current) => ({ ...current, tags: event.target.value }))}
              placeholder="supplier, holiday, weather"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
            <button
              type="submit"
              disabled={savingSignal}
              className="rounded-xl bg-[#E0A93A]/100 px-4 py-2.5 text-sm font-medium text-[#03182F] disabled:opacity-50"
            >
              {savingSignal ? 'Saving...' : 'Add context signal'}
            </button>
          </form>

          <div className="mt-5 space-y-3">
            {signals.map((signal) => (
              <div key={signal.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#03182F]">{signal.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#6B7480]">{signal.signal_type}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-[#6B7480]">
                    {signal.relevance_score}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#6B7480]">{signal.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-[#6B7480]">
                    {signal.impact_level}
                  </span>
                  {signal.geography ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-[#6B7480]">
                      {signal.geography}
                    </span>
                  ) : null}
                  {signal.tags?.map((tag) => (
                    <span key={`${signal.id}-${tag}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-[#6B7480]">
                      {tag}
                    </span>
                  ))}
                </div>
                {signal.recommendation ? (
                  <p className="mt-3 text-sm text-amber-700">
                    Linked recommendation: {signal.recommendation.title}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-card p-5">
          <h2 className="text-lg font-semibold text-[#03182F]">Planning recommendations</h2>
          <div className="mt-4 space-y-3">
            {recommendations.length === 0 ? (
              <p className="text-sm text-[#6B7480]">No planning recommendations yet.</p>
            ) : (
              recommendations.map((recommendation) => (
                <div key={recommendation.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#03182F]">{recommendation.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#6B7480]">
                        {recommendation.scenario_type}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(recommendation.status)}`}>
                      {recommendation.status}
                    </span>
                  </div>
                  {recommendation.expected_impact ? (
                    <p className="mt-3 text-sm text-[#6B7480]">{recommendation.expected_impact}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-[#6B7480]">
                    {new Date(recommendation.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
