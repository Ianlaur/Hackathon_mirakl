'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle, Loader2, Mic, RotateCw, Send, Sparkles } from 'lucide-react'
import { useAudioRecorder } from '@/components/useAudioRecorder'
import { usePluginContext } from '@/contexts/PluginContext'
import SimulatedBadge from '@/components/SimulatedBadge'
import MorningBriefingCard from '@/components/MorningBriefingCard'
import OrbModePanel from '@/components/OrbModePanel'

const GlobalShipmentTracker = dynamic(
  () => import('@/components/map/GlobalShipmentTracker'),
  {
    ssr: false,
    loading: () => <div className="h-[380px] animate-pulse rounded-xl bg-slate-900/80" />,
  }
)

type AtlasResponse = {
  updated_at: string
  founder: { state: string; until: string | null }
  oversell: { active: boolean; count: number; items: unknown[] }
  shield: {
    primary_channel: string | null
    paused_channels: string[]
    activated_at: string | null
    active: boolean
  }
  stock: { total_skus: number; at_risk: number; healthy: number; health_pct: number }
  totals: { orders_24h: number; revenue_24h: number; pending_decisions: number; handled_24h: number }
}

type OrderRow = {
  id: string
  external_id: string | null
  channel: string
  sku: string | null
  status: string
  amount_cents: number
  currency: string
  occurred_at: string | null
  has_pending_decision: boolean
}

type LedgerDecision = {
  id: string
  sku: string | null
  channel: string | null
  action_type: string | null
  template_id: string | null
  logical_inference: string | null
  raw_payload: Record<string, unknown> | null
  status: string
  reversible: boolean
  created_at: string
}

type DashboardChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoningSummary?: string
}

const CHANNEL_META: Record<string, { label: string; icon: string }> = {
  amazon_fr: { label: 'Amazon FR', icon: '🇫🇷' },
  amazon_it: { label: 'Amazon IT', icon: '🇮🇹' },
  amazon_de: { label: 'Amazon DE', icon: '🇩🇪' },
  google_shopping_fr: { label: 'Google Shopping FR', icon: '🛒' },
  google_shopping_it: { label: 'Google Shopping IT', icon: '🛒' },
  google_shopping_de: { label: 'Google Shopping DE', icon: '🛒' },
}

const STATUS_STYLE: Record<string, { label: string; style: string }> = {
  action_required: { label: 'ACTION REQUIRED', style: 'text-[#F22E75] bg-[#FFE7EC]' },
  in_transit: { label: 'IN TRANSIT', style: 'text-[#2764FF] bg-[#2764FF]/10' },
  delivered: { label: 'DELIVERED', style: 'text-[#3FA46A] bg-[#3FA46A]/10' },
  processing: { label: 'PROCESSING', style: 'text-[#03182F] bg-[#F2F8FF]' },
  cancelled: { label: 'CANCELLED', style: 'text-[#6B7480] bg-[#DDE5EE]' },
}

const DECISION_CARD_META: Record<
  string,
  { eyebrow: string; color: string; icon: 'alert' | 'spark'; primaryLabel: string }
> = {
  oversell_risk_v1: {
    eyebrow: 'STOCK EN TENSION',
    color: '#F22E75',
    icon: 'alert',
    primaryLabel: 'Pauser le listing',
  },
  restock_proposal_v1: {
    eyebrow: 'PROPOSITION DE RÉASSORT',
    color: '#2764FF',
    icon: 'spark',
    primaryLabel: 'Approuver',
  },
  seasonal_prediction_v1: {
    eyebrow: 'PRÉVISION SAISONNIÈRE',
    color: '#2764FF',
    icon: 'spark',
    primaryLabel: 'Ajuster le buffer',
  },
  returns_pattern_v1: {
    eyebrow: 'RETOURS RÉCURRENTS',
    color: '#F22E75',
    icon: 'alert',
    primaryLabel: 'Examiner',
  },
  reputation_shield_v1: {
    eyebrow: 'PROTECTION DES AVIS',
    color: '#2764FF',
    icon: 'spark',
    primaryLabel: 'Confirmer',
  },
  vacation_queue_v1: {
    eyebrow: 'FILE VACANCES',
    color: '#2764FF',
    icon: 'spark',
    primaryLabel: 'Traiter',
  },
}

function formatCurrency(cents: number, currency = 'EUR') {
  const value = (cents || 0) / 100
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return '—'
  }
}

function decisionTitle(d: LedgerDecision): string {
  const payload = (d.raw_payload ?? {}) as Record<string, unknown>
  const inputs = (payload.inputs ?? {}) as Record<string, unknown>
  switch (d.template_id) {
    case 'oversell_risk_v1':
      return d.sku ? `Risque d'oversell — ${d.sku}` : "Risque d'oversell"
    case 'restock_proposal_v1': {
      const qty = typeof inputs.qty === 'number' ? inputs.qty : null
      return d.sku
        ? `Réassort ${d.sku}${qty ? ` — ${qty} unités` : ''}`
        : 'Proposition de réassort'
    }
    case 'seasonal_prediction_v1':
      return d.sku ? `Pic saisonnier — ${d.sku}` : 'Pic saisonnier détecté'
    case 'returns_pattern_v1':
      return d.sku ? `Retours récurrents — ${d.sku}` : 'Retours récurrents détectés'
    case 'reputation_shield_v1':
      return 'Protection des avis activée'
    case 'vacation_queue_v1':
      return 'Action en file (vacances)'
    default:
      return d.logical_inference?.split('\n')[0] ?? 'Nouvelle décision'
  }
}

export default function DashboardPage() {
  const [query, setQuery] = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [mapTheme, setMapTheme] = useState<'dark' | 'light'>('dark')
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<DashboardChatMessage[]>([])
  const recorder = useAudioRecorder()
  const { isProPluginActive } = usePluginContext()
  const recording = recorder.state === 'recording'
  const starting = recorder.state === 'requesting'

  const [atlas, setAtlas] = useState<AtlasResponse | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [decisions, setDecisions] = useState<LedgerDecision[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoadingData(true)
    Promise.all([
      fetch('/api/mira/atlas').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/mira/orders-recent?limit=6').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/mira/ledger?status=proposed&limit=4').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([atlasRes, ordersRes, ledgerRes]) => {
      if (cancelled) return
      if (atlasRes && typeof atlasRes === 'object' && 'totals' in atlasRes) {
        setAtlas(atlasRes as AtlasResponse)
      }
      if (ordersRes && Array.isArray(ordersRes.orders)) {
        setOrders(ordersRes.orders as OrderRow[])
      }
      if (ledgerRes && Array.isArray(ledgerRes.decisions)) {
        setDecisions(ledgerRes.decisions as LedgerDecision[])
      }
      setLoadingData(false)
    })
    return () => {
      cancelled = true
    }
  }, [refreshToken])

  const visibleDecisions = useMemo(
    () => decisions.filter((d) => !dismissed.has(d.id)).slice(0, 2),
    [decisions, dismissed],
  )

  const approveDecision = useCallback(
    async (id: string) => {
      setDismissed((prev) => new Set(prev).add(id))
      try {
        await fetch(`/api/mira/decisions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve' }),
        })
      } catch {
        // keep optimistic dismissal; user can refresh
      }
      setRefreshToken((n) => n + 1)
    },
    [],
  )

  const ignoreDecision = useCallback((id: string) => {
    setDismissed((prev) => new Set(prev).add(id))
  }, [])

  async function handleMicClick() {
    if (recording) {
      const blob = await recorder.stop()
      if (!blob) return
      setTranscribing(true)
      try {
        const fd = new FormData()
        fd.append('audio', blob, 'prompt.webm')
        const res = await fetch('/api/mascot/transcribe', { method: 'POST', body: fd })
        if (res.ok) {
          const { text } = await res.json()
          if (text) setQuery((prev) => (prev ? prev + ' ' + text : text))
        }
      } catch {
        /* swallow — user can retry */
      } finally {
        setTranscribing(false)
      }
      return
    }
    if (recorder.state === 'idle') {
      await recorder.start()
    }
  }

  const micBusy = starting || transcribing
  const sendDisabled = sending || !query.trim()

  async function handleSend() {
    const message = query.trim()
    if (!message || sending) return

    setSending(true)
    setChatError(null)
    const userMessage: DashboardChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: message,
    }
    const nextMessages = [...chatMessages, userMessage]
    setChatMessages(nextMessages)

    try {
      const apiMessages = nextMessages.map((m) => ({ role: m.role, content: m.content }))
      const response = await fetch('/api/mascot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to contact Leia.')
      }

      const assistantContent =
        typeof payload?.message?.content === 'string'
          ? payload.message.content
          : 'Leia could not generate an answer right now.'

      setChatMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: assistantContent,
        },
      ])
      setQuery('')
      // After a vacation-style ask, refresh data so new MIRA decisions surface on the page.
      setRefreshToken((n) => n + 1)
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Failed to contact Leia.')
    } finally {
      setSending(false)
    }
  }

  const ordersToday = atlas?.totals.orders_24h ?? null
  const healthyCount = atlas?.stock.healthy ?? null
  const totalSkus = atlas?.stock.total_skus ?? null
  const healthPct = atlas?.stock.health_pct ?? null
  const healthPctDisplay = healthPct ?? 0
  const stockHealthy = healthPct !== null && healthPct >= 80

  const lastSyncLabel = atlas?.updated_at
    ? new Date(atlas.updated_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : loadingData
      ? 'Syncing…'
      : '—'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">Dashboard</h1>
        <div className="flex items-center gap-3">
          <div className="font-serif text-[12px] text-[#6B7480]">Last sync: {lastSyncLabel}</div>
          <button
            type="button"
            aria-label="Refresh"
            onClick={() => setRefreshToken((n) => n + 1)}
            className="rounded-full border border-[#DDE5EE] bg-white p-1.5 text-[#2764FF] hover:bg-[#F2F8FF] transition-colors"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Morning briefing — auto-open on first visit of the day */}
      <MorningBriefingCard />

      {/* AI Chat Bar */}
      <div className="relative w-full max-w-3xl mx-auto">
        <div className="bg-white rounded-full py-3 px-6 flex items-center gap-4 border border-[#DDE5EE] shadow-[0_4px_14px_rgba(3,24,47,0.08)] hover:shadow-[0_6px_20px_rgba(3,24,47,0.12)] transition-shadow">
          <svg className="h-5 w-5 text-[#2764FF] flex-shrink-0" viewBox="1 6 22 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="13" r="5" />
            <ellipse cx="5.5" cy="11" rx="2.5" ry="2" />
            <ellipse cx="18.5" cy="11" rx="2.5" ry="2" />
          </svg>
          <input
            className="bg-transparent border-none focus:ring-0 focus:outline-none text-[#03182F] font-serif text-sm flex-1 placeholder:text-[#6B7480]"
            placeholder={
              recording
                ? 'Recording… click the mic again to stop'
                : sending
                  ? 'Leia is responding…'
                  : 'Ask Leia for operational insights…'
            }
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void handleSend()
              }
            }}
          />
          <button
            type="button"
            onClick={handleMicClick}
            disabled={micBusy || !recorder.isSupported}
            aria-label={recording ? 'Stop recording' : 'Start voice input'}
            className={`rounded-full p-1.5 flex items-center justify-center transition-colors ${
              recording
                ? 'bg-[#F22E75] text-white animate-pulse shadow-[0_0_0_4px_rgba(242,46,117,0.18)]'
                : micBusy
                ? 'bg-[#DDE5EE] text-[#6B7480] cursor-wait'
                : 'bg-[#F2F8FF] text-[#2764FF] hover:bg-[#DDE5EE]'
            } disabled:opacity-60`}
          >
            {micBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="button"
            aria-label="Send"
            onClick={() => void handleSend()}
            disabled={sendDisabled}
            className="bg-[#2764FF] text-white rounded-full p-1.5 flex items-center justify-center hover:bg-[#004bd9] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {(chatMessages.length > 0 || chatError) && (
        <div className="mx-auto w-full max-w-3xl space-y-3">
          {chatMessages.slice(-4).map((message) => (
            <div
              key={message.id}
              className={`rounded-lg border p-4 shadow-[0_1px_4px_rgba(0,0,0,0.08)] ${
                message.role === 'assistant'
                  ? 'border-[#DDE5EE] bg-white'
                  : 'border-[#DDE5EE] bg-[#F2F8FF]'
              }`}
            >
              <p className="mb-2 font-serif text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7480]">
                {message.role === 'assistant' ? 'Leia' : 'You'}
              </p>
              <p className="font-serif text-[14px] leading-6 text-[#03182F]">{message.content}</p>
              {message.role === 'assistant' && message.reasoningSummary ? (
                <p className="mt-3 rounded border border-[#DDE5EE] bg-[#F2F8FF] px-3 py-2 font-serif text-[12px] text-[#30373E]">
                  {message.reasoningSummary}
                </p>
              ) : null}
            </div>
          ))}
          {chatError ? (
            <p className="rounded-lg border border-[#ba1a1a]/30 bg-[#FFE7EC] px-4 py-3 font-serif text-[13px] text-[#ba1a1a]">
              {chatError}
            </p>
          ) : null}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Orders 24H */}
        <div className="bg-white border border-[#DDE5EE] p-6 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)] flex flex-col gap-2">
          <div className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">TOTAL ORDERS (24H)</div>
          <div className="flex items-baseline justify-between">
            <div className="font-serif text-[44px] font-bold leading-none tracking-tight text-[#03182F]">
              {ordersToday === null ? '—' : ordersToday.toLocaleString('fr-FR')}
            </div>
            <div className="text-[#6B7480] font-serif text-sm">
              {atlas ? `${atlas.totals.handled_24h} handled` : ''}
            </div>
          </div>
          <div className="h-10 mt-2 flex items-end gap-1">
            <div className="flex-1 bg-[#2764FF]/10 h-4 rounded-sm" />
            <div className="flex-1 bg-[#2764FF]/10 h-6 rounded-sm" />
            <div className="flex-1 bg-[#2764FF]/10 h-5 rounded-sm" />
            <div className="flex-1 bg-[#2764FF]/20 h-8 rounded-sm" />
            <div className="flex-1 bg-[#2764FF]/30 h-10 rounded-sm" />
            <div className="flex-1 bg-[#2764FF] h-9 rounded-sm" />
          </div>
        </div>

        {/* Active SKUs */}
        <div className="bg-white border border-[#DDE5EE] p-6 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)] flex flex-col gap-2">
          <div className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">ACTIVE SKUS</div>
          <div className="flex items-baseline justify-between">
            <div className="font-serif text-[44px] font-bold leading-none tracking-tight text-[#03182F]">
              {healthyCount === null ? '—' : healthyCount}
            </div>
            <div className="text-[#6B7480] font-serif text-sm">
              {totalSkus === null ? '' : `of ${totalSkus} total`}
            </div>
          </div>
          <div className="mt-4 w-full h-1.5 bg-[#ededfa] rounded-full overflow-hidden">
            <div className="h-full bg-[#2764FF]" style={{ width: `${healthPctDisplay}%` }} />
          </div>
          <div className="font-serif text-[12px] text-[#6B7480] mt-2">
            {healthPct === null ? '…' : `Capacity optimization at ${healthPct}%`}
          </div>
        </div>

        {/* Stock Health */}
        <div className="bg-white border border-[#DDE5EE] p-6 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)] flex flex-col gap-2">
          <div className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">STOCK HEALTH</div>
          <div className="flex items-baseline justify-between">
            <div className="font-serif text-[44px] font-bold leading-none tracking-tight text-[#03182F]">
              {healthPct === null ? '—' : `${healthPct}%`}
            </div>
            {healthPct === null ? null : stockHealthy ? (
              <CheckCircle className="h-5 w-5 text-[#3FA46A]" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-[#F22E75]" />
            )}
          </div>
          <div className="h-10 mt-2 flex items-end gap-1">
            <div className={`flex-1 ${stockHealthy ? 'bg-[#3FA46A]/20' : 'bg-[#F22E75]/20'} h-8 rounded-sm`} />
            <div className={`flex-1 ${stockHealthy ? 'bg-[#3FA46A]/20' : 'bg-[#F22E75]/20'} h-9 rounded-sm`} />
            <div className={`flex-1 ${stockHealthy ? 'bg-[#3FA46A]/20' : 'bg-[#F22E75]/20'} h-8 rounded-sm`} />
            <div className={`flex-1 ${stockHealthy ? 'bg-[#3FA46A]/20' : 'bg-[#F22E75]/20'} h-7 rounded-sm`} />
            <div className={`flex-1 ${stockHealthy ? 'bg-[#3FA46A]/20' : 'bg-[#F22E75]/20'} h-9 rounded-sm`} />
            <div className={`flex-1 ${stockHealthy ? 'bg-[#3FA46A]' : 'bg-[#F22E75]'} h-10 rounded-sm`} />
          </div>
        </div>
      </div>

      {/* Global Map Card with plugin logic */}
      <div className="bg-white border border-[#DDE5EE] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
        <div className="p-6 border-b border-[#DDE5EE] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-[#03182F]">Global Shipment Map Pro</h2>
            <p className="font-serif text-[13px] text-[#6B7480] mt-1">
              Active en mode plugin complex. Masquée en mode basic.
            </p>
          </div>

          <div className="inline-flex items-center rounded-full border border-[#DDE5EE] bg-[#F2F8FF] p-1">
            <button
              type="button"
              onClick={() => setMapTheme('light')}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                mapTheme === 'light'
                  ? 'bg-white text-[#03182F] shadow-sm'
                  : 'text-[#6B7480] hover:text-[#30373E]'
              }`}
            >
              Clair
            </button>
            <button
              type="button"
              onClick={() => setMapTheme('dark')}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                mapTheme === 'dark'
                  ? 'bg-[#03182F] text-white shadow-sm'
                  : 'text-[#6B7480] hover:text-[#30373E]'
              }`}
            >
              Sombre
            </button>
          </div>
        </div>

        {isProPluginActive ? (
          <div className={`p-4 ${mapTheme === 'dark' ? 'bg-[#0B1020]' : 'bg-[#EEF3FB]'}`}>
            <GlobalShipmentTracker height={380} mapTheme={mapTheme} />
          </div>
        ) : (
          <div className="p-6">
            <div className="rounded-lg border border-dashed border-[#DDE5EE] bg-[#F2F8FF] p-5">
              <p className="font-serif text-[14px] text-[#30373E]">
                La carte est désactivée en mode basic. Passe en plugin complex pour l’afficher.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-[#DDE5EE] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
        <div className="p-6 border-b border-[#DDE5EE] flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-[#03182F]">Recent Operational Orders</h2>
          <a href="/orders" className="text-[#2764FF] font-serif text-sm font-medium hover:underline">View all orders</a>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#f3f2ff]">
              {['ORDER ID', 'MARKETPLACE', 'VALUE', 'STATUS', 'TIMESTAMP'].map((h) => (
                <th key={h} className="px-6 py-3 font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDE5EE]">
            {loadingData && orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center font-serif text-sm text-[#6B7480]">Loading…</td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center font-serif text-sm text-[#6B7480]">Aucune commande récente</td>
              </tr>
            ) : (
              orders.map((o) => {
                const meta = CHANNEL_META[o.channel] ?? { label: o.channel, icon: '🛒' }
                const status = STATUS_STYLE[o.status] ?? STATUS_STYLE.processing
                return (
                  <tr key={o.id} className="hover:bg-white transition-colors">
                    <td className="px-6 py-4 font-mono text-[14px] text-[#03182F]">{o.external_id ?? o.id.slice(0, 8)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-[#F2F8FF] flex items-center justify-center text-sm">{meta.icon}</div>
                        <span className="font-serif text-sm">{meta.label}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-serif text-sm font-bold">{formatCurrency(o.amount_cents, o.currency)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-serif ${status.style}`}>{status.label}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-[10px] text-[#6B7480]">{formatTime(o.occurred_at)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Decision Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
        {loadingData && visibleDecisions.length === 0 ? (
          <div className="md:col-span-2 bg-white border border-[#DDE5EE] p-6 rounded-lg text-center font-serif text-sm text-[#6B7480]">
            Loading decisions…
          </div>
        ) : visibleDecisions.length === 0 ? (
          <div className="md:col-span-2 bg-white border border-[#DDE5EE] p-6 rounded-lg text-center font-serif text-sm text-[#6B7480]">
            Aucune décision en attente — Leia veille.
          </div>
        ) : (
          visibleDecisions.map((d) => {
            const meta =
              (d.template_id && DECISION_CARD_META[d.template_id]) ?? {
                eyebrow: 'NOUVELLE DÉCISION',
                color: '#2764FF',
                icon: 'spark' as const,
                primaryLabel: 'Examiner',
              }
            return (
              <div
                key={d.id}
                className="bg-white border border-[#DDE5EE] p-6 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)] flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="font-serif text-[10px] font-bold tracking-[0.1em] uppercase"
                    style={{ color: meta.color }}
                  >
                    {meta.eyebrow}
                  </span>
                  {meta.icon === 'alert' ? (
                    <AlertTriangle className="h-4 w-4" style={{ color: meta.color }} />
                  ) : (
                    <Sparkles className="h-4 w-4" style={{ color: meta.color }} />
                  )}
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-[#03182F]">{decisionTitle(d)}</h3>
                  <p className="font-serif text-[13px] text-[#6B7480] mt-1 line-clamp-3">
                    {d.logical_inference ?? 'Détails disponibles dans la fiche action.'}
                  </p>
                </div>
                <div className="mt-auto pt-4 flex gap-3">
                  <button
                    onClick={() => approveDecision(d.id)}
                    className="bg-[#2764FF] text-white px-4 py-2 rounded font-serif text-sm hover:bg-[#004bd9] transition-colors flex-1"
                  >
                    {meta.primaryLabel}
                  </button>
                  <button
                    onClick={() => ignoreDecision(d.id)}
                    className="border border-[#BFCBDA] text-[#30373E] px-4 py-2 rounded font-serif text-sm hover:bg-[#F2F8FF] transition-colors"
                  >
                    Ignorer
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Leia — governance control per action_type */}
      <OrbModePanel />

      {/* Shield status footer (if active) */}
      {atlas?.shield.active ? (
        <div className="bg-[#FFE7EC] border border-[#F22E75]/30 rounded-lg p-4 flex items-center gap-3">
          <SimulatedBadge />
          <p className="font-serif text-[13px] text-[#03182F]">
            Reputation Shield actif — canal primaire <strong>{atlas.shield.primary_channel}</strong>,
            {' '}
            {atlas.shield.paused_channels.length} canal(aux) secondaires en pause.
          </p>
        </div>
      ) : null}
    </div>
  )
}
