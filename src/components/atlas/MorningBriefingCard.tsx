'use client'

// MIRA — morning digest surface for the Atlas home.
// Auto-fetches /api/mira/briefing on first mount of the day (localStorage
// timestamp). Founder can manually refresh. Spec: "au premier message de la
// journée, MIRA donne un briefing proactif". This is the PRIMAIRE version on
// the home screen (the chat-side briefing still works via the LLM system
// prompt when the founder starts a new conversation).

import { useCallback, useEffect, useState } from 'react'
import { Sun, RefreshCw } from 'lucide-react'

type QueuedDecision = {
  id: string
  sku: string | null
  template_id: string
  logical_inference: string
  created_at: string
}

type Briefing = {
  dateLabel: string
  founder: { state: string; until: string | null; is_away: boolean }
  summary: string
  counts: {
    orders_last_24h: number
    decisions_last_24h: number
    queued: number
    proposed: number
    auto_executed: number
  }
  queued_decisions: QueuedDecision[]
  needs_attention?: unknown[]
  stockout_watch?: unknown[]
}

const STORAGE_KEY = 'mira_briefing_shown_day'

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function MorningBriefingCard() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showingFirstOfDay, setShowingFirstOfDay] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/mira/briefing', { cache: 'no-store' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data: Briefing = await resp.json()
      setBriefing(data)
      try {
        localStorage.setItem(STORAGE_KEY, todayKey())
      } catch {
        /* storage disabled — silent fallback */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'briefing failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let lastShown = ''
    try {
      lastShown = localStorage.getItem(STORAGE_KEY) ?? ''
    } catch {
      /* noop */
    }
    if (lastShown !== todayKey()) {
      setShowingFirstOfDay(true)
      void load()
    }
  }, [load])

  if (!briefing && !loading && !error) {
    return (
      <div className="mira-card p-4">
        <div className="flex items-center justify-between">
          <div className="mira-label">Briefing</div>
          <button onClick={load} className="mira-button px-2 py-1 text-xs">
            Voir
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-600">Pas encore consulté aujourd&apos;hui.</p>
      </div>
    )
  }

  return (
    <div className="mira-card mira-card--raised p-4" style={{ borderLeft: '3px solid var(--mira-blue)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sun className="h-3.5 w-3.5 text-[color:var(--mira-blue)]" />
          <div className="mira-label">
            {showingFirstOfDay ? 'Briefing du matin' : 'Briefing'}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="mira-button inline-flex items-center gap-1 px-2 py-1 text-xs disabled:opacity-50"
          aria-label="Rafraîchir"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>
      {briefing ? (
        <>
          <h3 className="mira-display mt-1 text-[14px] font-bold">{briefing.dateLabel}</h3>
          <p className="mt-1 text-xs text-slate-700">{briefing.summary}</p>
          <ul className="mt-3 space-y-1 text-xs text-slate-700">
            <li className="flex justify-between">
              <span>Commandes 24h</span>
              <span className="tabular-nums">{briefing.counts.orders_last_24h}</span>
            </li>
            <li className="flex justify-between">
              <span>En file</span>
              <span className="tabular-nums">{briefing.counts.queued}</span>
            </li>
            <li className="flex justify-between">
              <span>À valider</span>
              <span className="tabular-nums">{briefing.counts.proposed}</span>
            </li>
            <li className="flex justify-between">
              <span>MIRA a géré</span>
              <span className="tabular-nums">{briefing.counts.auto_executed}</span>
            </li>
          </ul>
          {briefing.queued_decisions.length > 0 ? (
            <div className="mt-3 space-y-1 border-t border-[color:var(--mira-border)] pt-2">
              <div className="mira-label text-[10px]">File d&apos;attente</div>
              {briefing.queued_decisions.slice(0, 3).map((d) => (
                <p key={d.id} className="text-[11px] text-slate-600">
                  · {d.logical_inference}
                </p>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      {error ? <p className="mt-2 text-xs text-[color:var(--mira-pink)]">{error}</p> : null}
    </div>
  )
}
