'use client'

import { CalendarDays, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import type { DayBriefingData, DayTagLevel } from '@/types/copilot'

interface DayBriefingProps {
  initialBriefing: DayBriefingData
}

function tagTone(level: DayTagLevel) {
  if (level === 'urgent') return 'bg-rose-50 text-rose-700'
  if (level === 'attention') return 'bg-amber-50 text-amber-700'
  return 'bg-emerald-50 text-emerald-700'
}

export default function DayBriefing({ initialBriefing }: DayBriefingProps) {
  const [briefing, setBriefing] = useState<DayBriefingData>(initialBriefing)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  async function refreshBriefing() {
    setRefreshing(true)
    setError('')

    try {
      const response = await fetch('/api/dust/briefing', {
        method: 'GET',
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.briefing) {
        throw new Error(payload?.error || 'Briefing failed')
      }

      setBriefing(payload.briefing)
    } catch {
      setError('Impossible d actualiser maintenant.')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-slate-100 p-2 text-slate-600">
            <CalendarDays className="h-4 w-4" />
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{briefing.dateLabel}</p>
            <p className="mt-2 text-base font-semibold text-slate-900">{briefing.summary}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void refreshBriefing()
          }}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {briefing.tags.map((tag) => (
          <span
            key={`${tag.label}-${tag.level}`}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${tagTone(tag.level)}`}
          >
            {tag.label}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-3">
        <p>{briefing.metrics.activeShipments} expeditions actives</p>
        <p>{briefing.metrics.blockedOrders} bloquees</p>
        <p>{briefing.metrics.stockAlerts} alertes stock</p>
      </div>

      {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}
    </section>
  )
}
