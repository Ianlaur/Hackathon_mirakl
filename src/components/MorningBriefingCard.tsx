'use client'

import { useEffect, useState } from 'react'
import { Sunrise, X, ChevronRight, ArrowUpRight, ShieldAlert, Clock3, Flame } from 'lucide-react'

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
  queued_decisions: Array<{ id: string; sku: string | null; template_id: string; logical_inference: string; created_at: string }>
  needs_attention: Array<{ id: string; sku: string | null; template_id: string; logical_inference: string; created_at: string }>
  stockout_watch: Array<{ sku: string; on_hand: number; velocity_per_week: number; days_to_stockout: number }>
}

const STORAGE_KEY = 'mira_briefing_seen_date'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function prettyTemplate(id: string): string {
  // Strip the _vN suffix and turn snake_case into Title Case lite.
  return id
    .replace(/_v\d+$/, '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function MorningBriefingCard() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/mira/briefing')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((data) => {
        if (cancelled || !data || !data.summary) {
          setLoading(false)
          return
        }
        setBriefing(data as Briefing)
        try {
          const lastSeen = sessionStorage.getItem(STORAGE_KEY)
          if (lastSeen !== todayKey()) setOpen(true)
        } catch {
          setOpen(true)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const dismiss = () => {
    setOpen(false)
    try {
      sessionStorage.setItem(STORAGE_KEY, todayKey())
    } catch {
      /* noop */
    }
  }

  if (loading || !briefing) return null

  const attentionItems = [...briefing.needs_attention, ...briefing.queued_decisions].slice(0, 4)
  const criticalStockout = briefing.stockout_watch
    .slice()
    .sort((a, b) => a.days_to_stockout - b.days_to_stockout)
    .slice(0, 3)

  const needsCount = briefing.counts.proposed + briefing.counts.queued
  const handledCount = briefing.counts.auto_executed
  const ordersCount = briefing.counts.orders_last_24h

  return (
    <>
      {/* Always-visible pill */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-3 rounded-xl border border-[#E5EDF7] bg-white px-4 py-3 text-left font-serif text-[13px] text-[#30373E] shadow-[0_1px_2px_rgba(3,24,47,0.04)] transition-all hover:border-[#2764FF]/30 hover:shadow-[0_4px_12px_rgba(3,24,47,0.06)]"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFE9C2] to-[#FFCB6B] text-[#8B5A00]">
          <Sunrise className="h-3.5 w-3.5" />
        </span>
        <span className="flex-1 truncate font-medium text-[#03182F]">{briefing.summary}</span>
        <span className="hidden items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[#2764FF] md:inline-flex">
          Open
          <ChevronRight className="h-3.5 w-3.5" />
        </span>
        <ChevronRight className="h-4 w-4 text-[#9AA5B2] md:hidden" />
      </button>

      {/* Popup */}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) dismiss()
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Morning briefing"
        >
          {/* Soft backdrop */}
          <button
            type="button"
            aria-label="Close briefing"
            onClick={dismiss}
            className="absolute inset-0 bg-[#03182F]/40 backdrop-blur-[2px]"
          />

          <div
            className="relative z-10 w-full max-w-[640px] max-h-[90vh] overflow-y-auto rounded-[20px] border border-[#E5EDF7] bg-white shadow-[0_30px_80px_rgba(3,24,47,0.22)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dismiss */}
            <button
              type="button"
              aria-label="Close briefing"
              onClick={dismiss}
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#9AA5B2] transition-colors hover:bg-[#F2F8FF] hover:text-[#03182F]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="px-8 pt-8 pb-6">
              {/* Eyebrow */}
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#FFE9C2] to-[#FFCB6B] text-[#8B5A00] shadow-[0_1px_3px_rgba(255,203,107,0.5)]">
                  <Sunrise className="h-3 w-3" />
                </span>
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9AA5B2]">
                  Briefing · {briefing.dateLabel}
                </span>
                {briefing.founder.is_away ? (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#FFE7EC] px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-[#F22E75]">
                    <ShieldAlert className="h-3 w-3" />
                    {briefing.founder.state}
                  </span>
                ) : null}
              </div>

              {/* Hero line */}
              <h2 className="mt-4 font-serif text-[26px] font-semibold leading-[1.25] tracking-tight text-[#03182F]">
                {briefing.summary}
              </h2>

              {/* Three-stat strip, understated */}
              <div className="mt-6 grid grid-cols-3 divide-x divide-[#E5EDF7] overflow-hidden rounded-xl border border-[#E5EDF7] bg-gradient-to-b from-white to-[#FBFCFE]">
                <MiniStat label="À valider" value={needsCount} tone={needsCount > 0 ? 'attention' : 'neutral'} />
                <MiniStat label="Gérées seule" value={handledCount} tone="good" />
                <MiniStat label="Commandes 24h" value={ordersCount} />
              </div>

              {/* What needs you */}
              {attentionItems.length > 0 ? (
                <section className="mt-7">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5 text-[#2764FF]" />
                      <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7480]">
                        Ce qui vous attend
                      </h3>
                    </div>
                    <span className="font-mono text-[10px] font-semibold text-[#9AA5B2]">
                      {attentionItems.length} item{attentionItems.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {attentionItems.map((d) => (
                      <li key={d.id}>
                        <a
                          href="/actions"
                          className="group flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-[#E5EDF7] hover:bg-[#F8FAFD]"
                        >
                          <span className="mt-0.5 font-mono text-[11px] font-semibold text-[#2764FF]">
                            {d.sku ?? '—'}
                          </span>
                          <span className="flex-1 text-[13px] leading-5 text-[#30373E]">
                            <span className="font-semibold text-[#03182F]">{prettyTemplate(d.template_id)}</span>
                            <span className="text-[#6B7480]">
                              {' · '}
                              {d.logical_inference.split('\n')[0]}
                            </span>
                          </span>
                          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9AA5B2] transition-colors group-hover:text-[#2764FF]" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/* Stockout watch */}
              {criticalStockout.length > 0 ? (
                <section className="mt-6">
                  <div className="mb-3 flex items-center gap-2">
                    <Flame className="h-3.5 w-3.5 text-[#F22E75]" />
                    <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6B7480]">
                      Rupture imminente
                    </h3>
                  </div>
                  <ul className="space-y-2">
                    {criticalStockout.map((s) => {
                      const days = s.days_to_stockout
                      const clamp = Math.max(0, Math.min(days / 7, 1)) // 0..1 over one week
                      const urgent = days < 3
                      return (
                        <li key={s.sku} className="flex items-center gap-3">
                          <span className="font-mono text-[11px] font-semibold text-[#03182F] w-[72px] shrink-0">
                            {s.sku}
                          </span>
                          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#F2F4F7]">
                            <div
                              className={`absolute inset-y-0 left-0 rounded-full ${
                                urgent ? 'bg-[#F22E75]' : 'bg-[#E0A93A]'
                              }`}
                              style={{ width: `${clamp * 100}%` }}
                            />
                          </div>
                          <span
                            className={`font-mono text-[11px] font-semibold tabular-nums ${
                              urgent ? 'text-[#F22E75]' : 'text-[#30373E]'
                            }`}
                          >
                            {days.toFixed(1)} j
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ) : null}
            </div>

            {/* Footer CTA bar */}
            <div className="flex items-center justify-between gap-3 border-t border-[#E5EDF7] bg-[#FBFCFE] px-8 py-4">
              <button
                type="button"
                onClick={dismiss}
                className="font-serif text-[13px] font-medium text-[#6B7480] hover:text-[#03182F]"
              >
                Not now
              </button>
              <a
                href="/actions"
                onClick={dismiss}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#03182F] px-5 font-serif text-[13px] font-semibold text-white transition-colors hover:bg-[#2764FF]"
              >
                Review {needsCount > 0 ? `${needsCount} action${needsCount > 1 ? 's' : ''}` : 'actions'}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function MiniStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: number
  tone?: 'neutral' | 'good' | 'attention'
}) {
  const valueColor =
    tone === 'good'
      ? 'text-[#3FA46A]'
      : tone === 'attention' && value > 0
        ? 'text-[#F22E75]'
        : 'text-[#03182F]'
  return (
    <div className="flex flex-col items-center justify-center px-3 py-4">
      <p className={`font-serif text-[28px] font-semibold leading-none tracking-tight tabular-nums ${valueColor}`}>
        {value.toLocaleString('fr-FR')}
      </p>
      <p className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9AA5B2]">
        {label}
      </p>
    </div>
  )
}
