'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Inbox,
  RefreshCcw,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useMiraLedger, type MiraDecision } from '@/hooks/useMiraLedger'

const STATUS_STYLES: Record<string, { bg: string; label: string; urgent: boolean }> = {
  auto_executed: { bg: 'bg-[#2764FF]/10 text-[#2764FF]', label: 'Handled', urgent: false },
  proposed: { bg: 'bg-[#F22E75]/10 text-[#F22E75]', label: 'Needs approval', urgent: true },
  queued: { bg: 'bg-[#F22E75]/10 text-[#F22E75]', label: 'Queued', urgent: true },
  rejected: { bg: 'bg-[#03182F]/5 text-[#03182F]/60', label: 'Rejected', urgent: false },
  overridden: { bg: 'bg-[#03182F]/5 text-[#03182F]/60', label: 'Overridden', urgent: false },
  skipped: { bg: 'bg-[#03182F]/5 text-[#03182F]/60', label: 'Skipped', urgent: false },
}

type SignalTone = 'alert' | 'blue'

type DecisionSignal = {
  title: string
  metric: string
  subMetric: string
  barPct: number
  tone: SignalTone
  direction: 'down' | 'up' | 'flat'
}

function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const s = Math.max(0, Math.round(diffMs / 1000))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function templateInput(decision: MiraDecision): Record<string, unknown> {
  return asRecord(asRecord(decision.raw_payload).applied_template_input)
}

function num(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function compactAction(value: string) {
  return value.replaceAll('_', ' ')
}

function signalFor(decision: MiraDecision): DecisionSignal {
  const input = templateInput(decision)
  const sku = decision.sku || String(input.sku || 'SKU')

  if (decision.template_id === 'oversell_risk_v1') {
    const onHand = num(input.on_hand)
    const sold = num(input.total_24h)
    const pressure = Math.min(100, Math.max(8, sold ? (sold / Math.max(onHand, 1)) * 36 : 32))
    return {
      title: sku,
      metric: `${onHand} left`,
      subMetric: `${sold} sold / 24h`,
      barPct: pressure,
      tone: 'alert',
      direction: 'down',
    }
  }

  if (decision.template_id === 'restock_proposal_v1') {
    const qty = num(input.qty)
    const velocity = num(input.velocity_per_week)
    return {
      title: sku,
      metric: `+${qty} units`,
      subMetric: `${velocity}/wk velocity`,
      barPct: Math.min(100, Math.max(18, qty ? 68 : 24)),
      tone: decision.status === 'auto_executed' ? 'blue' : 'alert',
      direction: 'up',
    }
  }

  if (decision.template_id === 'buffer_adjustment_v1') {
    const oldBuffer = num(input.old_buffer)
    const newBuffer = num(input.new_buffer)
    const delta = newBuffer - oldBuffer
    return {
      title: sku,
      metric: `${oldBuffer}->${newBuffer} wk`,
      subMetric: `${delta >= 0 ? '+' : ''}${delta} wk buffer`,
      barPct: Math.min(100, Math.max(18, Math.abs(delta) * 24)),
      tone: delta < 0 || decision.status !== 'auto_executed' ? 'alert' : 'blue',
      direction: delta >= 0 ? 'up' : 'down',
    }
  }

  if (decision.template_id === 'listing_pause_v1') {
    return {
      title: sku,
      metric: 'Pause listing',
      subMetric: String(input.channel || decision.channel || 'All channels'),
      barPct: 74,
      tone: 'alert',
      direction: 'down',
    }
  }

  if (decision.template_id === 'listing_resume_v1') {
    return {
      title: sku,
      metric: 'Resume listing',
      subMetric: String(input.channel || decision.channel || 'All channels'),
      barPct: 62,
      tone: 'blue',
      direction: 'up',
    }
  }

  if (decision.template_id === 'returns_pattern_v1') {
    const rate = num(input.rate_pct)
    const baseline = num(input.baseline_pct)
    return {
      title: sku,
      metric: `${rate}% returns`,
      subMetric: `${baseline}% baseline`,
      barPct: Math.min(100, Math.max(12, rate)),
      tone: rate > baseline ? 'alert' : 'blue',
      direction: rate > baseline ? 'up' : 'flat',
    }
  }

  if (decision.template_id === 'reconciliation_variance_v1') {
    const variance = num(input.variance_pct)
    return {
      title: sku,
      metric: `${variance}% variance`,
      subMetric: `${num(input.observed)}/${num(input.expected)} stock`,
      barPct: Math.min(100, Math.max(10, Math.abs(variance))),
      tone: 'alert',
      direction: 'down',
    }
  }

  return {
    title: sku,
    metric: compactAction(decision.action_type),
    subMetric: decision.channel || decision.template_id,
    barPct: decision.status === 'auto_executed' ? 100 : 52,
    tone: decision.status === 'auto_executed' ? 'blue' : 'alert',
    direction: decision.status === 'auto_executed' ? 'flat' : 'down',
  }
}

function RiskSparkline({ tone, direction }: { tone: SignalTone; direction: DecisionSignal['direction'] }) {
  const color = tone === 'alert' ? '#F22E75' : '#2764FF'
  const path =
    direction === 'up'
      ? 'M2 22 L12 16 L20 18 L30 8 L42 12 L54 4'
      : direction === 'flat'
        ? 'M2 15 L12 14 L22 15 L34 13 L44 14 L54 12'
        : 'M2 5 L12 9 L20 8 L30 16 L42 14 L54 22'

  return (
    <svg aria-hidden="true" viewBox="0 0 56 28" className="h-8 w-16">
      <path d="M2 24 H54" fill="none" stroke="#03182F" strokeOpacity="0.08" strokeWidth="2" />
      <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
    </svg>
  )
}

function DecisionMetricBar({ pct, tone }: { pct: number; tone: SignalTone }) {
  const width = `${Math.min(100, Math.max(4, pct))}%`

  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#03182F]/8">
      <div className={tone === 'alert' ? 'h-full bg-[#F22E75]' : 'h-full bg-[#2764FF]'} style={{ width }} />
    </div>
  )
}

function DecisionItem({ decision }: { decision: MiraDecision }) {
  const style = STATUS_STYLES[decision.status] || STATUS_STYLES.skipped
  const signal = signalFor(decision)
  const StatusIcon = style.urgent ? AlertTriangle : decision.status === 'overridden' ? RotateCcw : CheckCircle2
  const TrendIcon = signal.direction === 'up' ? TrendingUp : signal.direction === 'down' ? TrendingDown : CheckCircle2

  return (
    <Link
      href={`/actions?decision=${decision.id}`}
      className="block rounded-md bg-[#FFFFFF] p-4 text-left shadow-sm transition hover:bg-[#F2F8FF]"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-bold ${style.bg}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {style.urgent ? <span className="badge-pulse h-1.5 w-1.5 rounded-full bg-[#F22E75]" /> : null}
          {style.label}
        </span>
        <span className="font-mono text-xs text-[#03182F]/45">{formatTimeAgo(decision.created_at)}</span>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-bold text-[#2764FF]">{signal.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#03182F]">{signal.metric}</span>
            <span className="rounded-md bg-[#03182F]/5 px-2 py-0.5 text-[11px] font-bold text-[#03182F]/55">
              {signal.subMetric}
            </span>
          </div>
        </div>
        <div className={signal.tone === 'alert' ? 'text-[#F22E75]' : 'text-[#2764FF]'}>
          <TrendIcon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <DecisionMetricBar pct={signal.barPct} tone={signal.tone} />
        <RiskSparkline tone={signal.tone} direction={signal.direction} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#03182F]/45">
        <span>{decision.template_id}</span>
        {decision.channel ? <span>{decision.channel}</span> : null}
        <span>{decision.id.slice(0, 8)}</span>
      </div>
    </Link>
  )
}

export function MiraDecisionFeed({ limit = 12 }: { limit?: number }) {
  const { decisions, loading, realtimeConnected, error, refresh } = useMiraLedger(limit)

  return (
    <section className="feed-in mira-card p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="mira-label">Mira</p>
          <h2 className="mt-2 text-2xl font-semibold leading-7 text-[#03182F]">
            Needs Your Decision
          </h2>
          <p className="mt-1 text-xs text-[#03182F]/55">
            {realtimeConnected ? (
              <span className="inline-flex items-center gap-2">
                <span className="mira-live-dot" />
                Realtime ledger
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5" />
                Manual refresh
              </span>
            )}
          </p>
        </div>
        <button
          onClick={refresh}
          className="mira-button inline-flex items-center gap-2 px-3 py-2 text-xs text-[#2764FF]"
          type="button"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </header>

      {error ? (
        <p className="rounded-md bg-[#F22E75]/10 p-3 text-sm text-[#F22E75]">Ledger error: {error}</p>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-md bg-[#F2F8FF]" />
          ))}
        </div>
      ) : decisions.length === 0 ? (
        <div className="rounded-md bg-[#F2F8FF] p-6 text-center text-sm text-[#03182F]/65">
          <Inbox className="mx-auto mb-3 h-5 w-5 text-[#2764FF]" />
          <span className="font-semibold text-[#03182F]">Ledger empty</span>
          <span className="mt-1 block text-xs">Ask Iris / governed action</span>
        </div>
      ) : (
        <div className="space-y-2">
          {decisions.map((decision) => (
            <DecisionItem key={decision.id} decision={decision} />
          ))}
        </div>
      )}
    </section>
  )
}
