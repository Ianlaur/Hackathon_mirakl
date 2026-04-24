'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Loader2, Mic, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { LeiaChatMessageBubble, type LeiaToolCall } from '@/components/LeiaChatMessageBubble'
import { useAudioRecorder } from '@/components/useAudioRecorder'
import { usePluginContext } from '@/contexts/PluginContext'
import { LEIA_QUICK_PROMPTS } from '@/lib/leia-prompts'
import { getRecommendationSyncNotice } from '@/lib/demo-feedback'
import {
  buildDashboardHistoryMessage,
  getDashboardPrimaryActionLabel,
  getDashboardSecondaryActionLabel,
  selectDashboardRecommendations,
} from '@/lib/dashboard'

const GlobalShipmentTracker = dynamic(
  () => import('@/components/map/GlobalShipmentTracker'),
  {
    ssr: false,
    loading: () => <div className="h-[380px] animate-pulse rounded-xl bg-slate-900/80" />,
  }
)

type DashboardOrderRow = {
  id: string
  marketplace: string
  icon: string
  value: string
  status: string
  statusStyle: string
  time: string
}

type DashboardRecommendationRow = {
  id: string
  title: string
  scenario_type: string
  status: string
  reasoning_summary: string
  created_at: string
}

type DashboardChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoningSummary?: string
  tool_calls?: LeiaToolCall[]
}

const fallbackOrders: DashboardOrderRow[] = [
  {
    id: 'MK-8829-X',
    marketplace: 'Amazon US',
    icon: 'AMZ',
    value: '$249.00',
    status: 'FULFILLED',
    statusStyle: 'text-[#3FA46A] bg-[#3FA46A]/10',
    time: '14:22:05',
  },
  {
    id: 'MK-8830-L',
    marketplace: 'Maison du Monde',
    icon: 'MDM',
    value: '$1,120.45',
    status: 'PROCESSING',
    statusStyle: 'text-[#2764FF] bg-[#2764FF]/10',
    time: '14:18:12',
  },
  {
    id: 'MK-8831-Z',
    marketplace: 'Zalando EU',
    icon: 'ZLD',
    value: '$89.99',
    status: 'RISK ATTACHED',
    statusStyle: 'text-[#F22E75] bg-[#FFE7EC]',
    time: '14:05:44',
  },
  {
    id: 'MK-8832-P',
    marketplace: 'Carrefour',
    icon: 'CRF',
    value: '$42.50',
    status: 'FULFILLED',
    statusStyle: 'text-[#3FA46A] bg-[#3FA46A]/10',
    time: '13:59:30',
  },
]

function formatOrderValue(totalPrice: string | null | undefined, currency: string | null | undefined) {
  if (!totalPrice) return '—'

  const amount = Number(totalPrice)
  if (Number.isNaN(amount)) return totalPrice

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatOrderTime(value: string | null | undefined) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getOrderStatusPresentation(
  financialStatus: string | null | undefined,
  fulfillmentStatus: string | null | undefined
) {
  if (financialStatus === 'pending') {
    return {
      status: 'PAYMENT PENDING',
      statusStyle: 'text-[#F22E75] bg-[#FFE7EC]',
    }
  }

  if (!fulfillmentStatus) {
    return {
      status: 'PROCESSING',
      statusStyle: 'text-[#2764FF] bg-[#2764FF]/10',
    }
  }

  if (fulfillmentStatus === 'fulfilled') {
    return {
      status: 'FULFILLED',
      statusStyle: 'text-[#3FA46A] bg-[#3FA46A]/10',
    }
  }

  return {
    status: fulfillmentStatus.toUpperCase(),
    statusStyle: 'text-[#2764FF] bg-[#2764FF]/10',
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [mapTheme, setMapTheme] = useState<'dark' | 'light'>('dark')
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [inputLanguage, setInputLanguage] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<DashboardChatMessage[]>([])
  const [chatOpen, setChatOpen] = useState(false)
  const [recommendations, setRecommendations] = useState<DashboardRecommendationRow[]>([])
  const [recommendationsLoading, setRecommendationsLoading] = useState(true)
  const [ordersData, setOrdersData] = useState<DashboardOrderRow[]>(fallbackOrders)
  const [busyRecommendationId, setBusyRecommendationId] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const recorder = useAudioRecorder()
  const { isProPluginActive } = usePluginContext()
  const recording = recorder.state === 'recording'
  const starting = recorder.state === 'requesting'

  const dashboardRecommendations = useMemo(
    () => selectDashboardRecommendations(recommendations, 2),
    [recommendations]
  )

  async function loadRecommendations() {
    try {
      const response = await fetch('/api/copilot/recommendations?status=pending_approval', {
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load actions.')
      }

      setRecommendations(
        Array.isArray(payload?.recommendations)
          ? payload.recommendations.map((item: DashboardRecommendationRow) => ({
              id: item.id,
              title: item.title,
              scenario_type: item.scenario_type,
              status: item.status,
              reasoning_summary: item.reasoning_summary,
              created_at: item.created_at,
            }))
          : []
      )
    } catch (error) {
      console.error('Dashboard recommendations error:', error)
      setRecommendations([])
    } finally {
      setRecommendationsLoading(false)
    }
  }

  async function loadOrders() {
    try {
      const response = await fetch('/api/orders/shopify?limit=4', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !Array.isArray(payload?.orders) || payload.orders.length === 0) {
        setOrdersData(fallbackOrders)
        return
      }

      setOrdersData(
        payload.orders.map(
          (order: {
            id: string
            source: string | null
            totalPrice: string | null
            currency: string | null
            financialStatus: string | null
            fulfillmentStatus: string | null
            createdAt: string | null
          }) => {
            const presentation = getOrderStatusPresentation(
              order.financialStatus,
              order.fulfillmentStatus
            )

            return {
              id: order.id.slice(0, 8).toUpperCase(),
              marketplace: order.source || 'Shopify',
              icon: (order.source || 'SHP').slice(0, 3).toUpperCase(),
              value: formatOrderValue(order.totalPrice, order.currency),
              status: presentation.status,
              statusStyle: presentation.statusStyle,
              time: formatOrderTime(order.createdAt),
            }
          }
        )
      )
    } catch (error) {
      console.error('Dashboard orders error:', error)
      setOrdersData(fallbackOrders)
    }
  }

  async function handleMicClick() {
    if (recording) {
      const blob = await recorder.stop()
      if (!blob) return
      setTranscribing(true)
      try {
        const fd = new FormData()
        fd.append('file', blob, 'prompt.webm')
        const res = await fetch('/api/mascot/transcribe', { method: 'POST', body: fd })
        if (res.ok) {
          const { text, language } = await res.json()
          if (text) setQuery((prev) => (prev ? `${prev} ${text}` : text))
          if (typeof language === 'string' && language) setInputLanguage(language)
        }
      } catch {
        // Let the user retry without extra noise.
      } finally {
        setTranscribing(false)
      }
      return
    }
    if (recorder.state === 'idle') {
      await recorder.start()
    }
  }

  async function handleRecommendationAction(
    recommendation: DashboardRecommendationRow,
    action: 'approve' | 'reject'
  ) {
    setBusyRecommendationId(recommendation.id)
    setChatError(null)

    try {
      const response = await fetch(
        `/api/copilot/recommendations/${recommendation.id}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to update action.')
      }

      const nextStatus =
        typeof payload?.recommendation?.status === 'string'
          ? payload.recommendation.status
          : action === 'approve'
            ? 'approved'
            : 'rejected'

      setRecommendations((current) =>
        current
          .map((item) =>
            item.id === recommendation.id ? { ...item, status: nextStatus } : item
          )
          .filter((item) => item.status === 'pending_approval')
      )

      const historyMessage = buildDashboardHistoryMessage(recommendation, action)
      setChatMessages((current) => [
        ...current,
        {
          id: `decision-${recommendation.id}-${Date.now()}`,
          role: 'assistant',
          content: historyMessage.content,
          reasoningSummary: historyMessage.reasoningSummary,
          tool_calls: undefined,
        },
      ])
      setActionNotice(getRecommendationSyncNotice(action, recommendation.title))
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Failed to update action.')
    } finally {
      setBusyRecommendationId(null)
    }
  }

  const micBusy = starting || transcribing
  const sendDisabled = sending || !query.trim()

  useEffect(() => {
    void loadRecommendations()
    void loadOrders()
  }, [])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [query])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatMessages, sending])

  useEffect(() => {
    if (!chatOpen) return
    const timer = setTimeout(() => inputRef.current?.focus(), 80)
    return () => clearTimeout(timer)
  }, [chatOpen])

  useEffect(() => {
    if (!chatOpen) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setChatOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onEscape)
    }
  }, [chatOpen])

  useEffect(() => {
    if (!actionNotice) return
    const timer = setTimeout(() => setActionNotice(null), 4500)
    return () => clearTimeout(timer)
  }, [actionNotice])

  async function handleSend() {
    return handleSendMessage(query.trim())
  }

  async function handleSendMessage(rawMessage: string) {
    const message = rawMessage.trim()
    if (!message || sending) return

    setSending(true)
    setChatError(null)
      setChatMessages((current) => [
        ...current,
        {
          id: `u-${Date.now()}`,
          role: 'user',
          content: message,
          tool_calls: undefined,
        },
      ])

    try {
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          message,
          language: inputLanguage || undefined,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to contact Leia.')
      }

      if (typeof payload?.sessionId === 'string' && payload.sessionId) {
        setSessionId(payload.sessionId)
      }

      const assistantContent =
        typeof payload?.message?.content === 'string'
          ? payload.message.content
          : 'Leia could not generate an answer right now.'
      const reasoningSummary =
        typeof payload?.message?.reasoning_summary === 'string'
          ? payload.message.reasoning_summary
          : undefined

      setChatMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: assistantContent,
          reasoningSummary,
          tool_calls: Array.isArray(payload?.tool_calls) ? payload.tool_calls : undefined,
        },
      ])
      setQuery('')
      setInputLanguage(null)
      void loadRecommendations()
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Failed to contact Leia.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">Dashboard</h1>
        <div className="font-serif text-[12px] text-[#6B7480]">Last sync: 2 minutes ago</div>
      </div>

      <div className="relative mx-auto w-full max-w-3xl">
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="iris-searchbar w-full text-left"
          aria-label="Open Leia conversation"
        >
          <div className="iris-searchbar__glyph" aria-hidden>
            <span className="iris-searchbar__dot iris-searchbar__dot--pink" />
            <span className="iris-searchbar__dot iris-searchbar__dot--blue" />
            <span className="iris-searchbar__dot iris-searchbar__dot--violet" />
          </div>
          <span className="iris-searchbar__input font-serif text-[#6B7480]">
            {sending ? 'Leia is responding…' : 'Ask Leia for operational insights…'}
          </span>
          <span className="iris-searchbar__mic" aria-hidden>
            <Mic className="h-4 w-4" />
          </span>
          <span className="iris-searchbar__submit" aria-hidden>
            <ArrowUp className="h-4 w-4" />
          </span>
        </button>
      </div>

      {actionNotice ? (
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-lg border border-[#3FA46A]/20 bg-[#3FA46A]/10 px-4 py-3 text-sm text-[#03182F] shadow-[0_1px_4px_rgba(3,24,47,0.08)]">
          <p className="font-serif">{actionNotice}</p>
          <button
            type="button"
            onClick={() => router.push('/actions')}
            className="shrink-0 rounded border border-[#BFCBDA] bg-white px-3 py-1.5 font-serif text-[12px] font-bold text-[#30373E] transition-all duration-150 ease-out hover:bg-[#F2F8FF] focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50"
          >
            Open Actions
          </button>
        </div>
      ) : null}

      <div
        className={`iris-overlay ${chatOpen ? 'iris-overlay--open' : 'iris-overlay--closed'}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) setChatOpen(false)
        }}
        aria-hidden={!chatOpen}
      >
        <div className={`iris-panel ${chatOpen ? 'iris-panel--open' : 'iris-panel--closed'}`}>
          <div ref={scrollRef} className="iris-conversation iris-conversation--panel">
            {chatMessages.length === 0 && !sending && !chatError ? (
              <div className="iris-conversation__empty">
                <div className="iris-conversation__empty-header">
                  <div className="iris-searchbar__glyph" aria-hidden>
                    <span className="iris-searchbar__dot iris-searchbar__dot--pink" />
                    <span className="iris-searchbar__dot iris-searchbar__dot--blue" />
                    <span className="iris-searchbar__dot iris-searchbar__dot--violet" />
                  </div>
                  <p className="iris-conversation__empty-title font-serif">Leia is ready</p>
                </div>
                <p className="iris-conversation__empty-copy font-serif">
                  Ask about stock, leave planning, or pending actions.
                </p>
                <div className="iris-conversation__suggestions">
                  {LEIA_QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.label}
                      type="button"
                      onClick={() => void handleSendMessage(prompt.message)}
                      className="iris-conversation__suggestion"
                    >
                      {prompt.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {chatMessages.map((message) => (
              <LeiaChatMessageBubble
                key={message.id}
                message={message}
                onNavigate={() => setChatOpen(false)}
              />
            ))}

            {sending ? (
              <div className="iris-conversation__thinking">
                <span className="iris-conversation__thinking-dot" />
                <span className="iris-conversation__thinking-dot" />
                <span className="iris-conversation__thinking-dot" />
              </div>
            ) : null}

            {chatError ? <div className="iris-conversation__error">{chatError}</div> : null}
          </div>

          <form
            className="iris-searchbar"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSend()
            }}
          >
            <div className="iris-searchbar__glyph" aria-hidden>
              <span className="iris-searchbar__dot iris-searchbar__dot--pink" />
              <span className="iris-searchbar__dot iris-searchbar__dot--blue" />
              <span className="iris-searchbar__dot iris-searchbar__dot--violet" />
            </div>
            <textarea
              ref={inputRef}
              className="iris-searchbar__input font-serif"
              placeholder={
                recording
                  ? 'Recording… click mic again to stop'
                  : sending
                    ? 'Leia is responding…'
                    : 'Ask Leia for operational insights…'
              }
              rows={1}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void handleSend()
                }
              }}
              disabled={sending || transcribing || recording}
            />
            {recorder.isSupported ? (
              <button
                type="button"
                onClick={() => void handleMicClick()}
                disabled={micBusy || sending}
                aria-label={recording ? 'Stop recording' : 'Start voice input'}
                className={`iris-searchbar__mic ${
                  recording ? 'iris-searchbar__mic--recording' : ''
                } ${transcribing ? 'iris-searchbar__mic--transcribing' : ''}`}
              >
                {micBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
              </button>
            ) : null}
            <button
              type="submit"
              aria-label="Send"
              disabled={sendDisabled}
              className="iris-searchbar__submit"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              aria-label="Close Leia conversation"
              className="iris-searchbar__clear"
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[#DDE5EE] p-6 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)] flex flex-col gap-2">
          <div className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">TOTAL ORDERS TODAY</div>
          <div className="flex items-baseline justify-between">
            <div className="font-serif text-[44px] font-bold leading-none tracking-tight text-[#03182F]">1,284</div>
            <div className="text-[#3FA46A] font-serif italic text-sm">+12% vs yesterday</div>
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

        <div className="bg-white border border-[#DDE5EE] p-6 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)] flex flex-col gap-2">
          <div className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">ACTIVE SKUS</div>
          <div className="flex items-baseline justify-between">
            <div className="font-serif text-[44px] font-bold leading-none tracking-tight text-[#03182F]">186</div>
            <div className="text-[#6B7480] font-serif text-sm">of 200 total</div>
          </div>
          <div className="mt-4 w-full h-1.5 bg-[#ededfa] rounded-full overflow-hidden">
            <div className="h-full bg-[#2764FF] w-[93%]" />
          </div>
          <div className="font-serif text-[12px] text-[#6B7480] mt-2">Capacity optimization at 93%</div>
        </div>

        <div className="bg-white border border-[#DDE5EE] p-6 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)] flex flex-col gap-2">
          <div className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">STOCK HEALTH</div>
          <div className="flex items-baseline justify-between">
            <div className="font-serif text-[44px] font-bold leading-none tracking-tight text-[#03182F]">94%</div>
            <span className="text-[#3FA46A] text-xl">&#10003;</span>
          </div>
          <div className="h-10 mt-2 flex items-end gap-1">
            <div className="flex-1 bg-[#3FA46A]/20 h-8 rounded-sm" />
            <div className="flex-1 bg-[#3FA46A]/20 h-9 rounded-sm" />
            <div className="flex-1 bg-[#3FA46A]/20 h-8 rounded-sm" />
            <div className="flex-1 bg-[#3FA46A]/20 h-7 rounded-sm" />
            <div className="flex-1 bg-[#3FA46A]/20 h-9 rounded-sm" />
            <div className="flex-1 bg-[#3FA46A] h-10 rounded-sm" />
          </div>
        </div>
      </div>

      {isProPluginActive && (
        <div className="bg-white border border-[#DDE5EE] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
          <div className="p-6 border-b border-[#DDE5EE] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-bold text-[#03182F]">Global Shipment Map Pro</h2>
              <p className="font-serif text-[13px] text-[#6B7480] mt-1">
                Active en mode plugin complex.
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

          <div className={`p-4 ${mapTheme === 'dark' ? 'bg-[#0B1020]' : 'bg-[#EEF3FB]'}`}>
            <GlobalShipmentTracker height={380} mapTheme={mapTheme} />
          </div>
        </div>
      )}

      <div className="bg-white border border-[#DDE5EE] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
        <div className="p-6 border-b border-[#DDE5EE] flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-[#03182F]">Recent Operational Orders</h2>
          <button
            type="button"
            onClick={() => router.push('/orders')}
            className="text-[#2764FF] font-serif text-sm font-medium transition-all duration-150 ease-out hover:underline focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50 rounded"
          >
            View all orders
          </button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#f3f2ff]">
              {['ORDER ID', 'MARKETPLACE', 'VALUE', 'STATUS', 'TIMESTAMP'].map((heading) => (
                <th
                  key={heading}
                  className="px-6 py-3 font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDE5EE]">
            {ordersData.map((order) => (
              <tr key={order.id} className="hover:bg-white transition-colors">
                <td className="px-6 py-4 font-mono text-[14px] text-[#03182F]">{order.id}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#F2F8FF] flex items-center justify-center text-[10px] font-bold text-[#03182F]">
                      {order.icon}
                    </div>
                    <span className="font-serif text-sm">{order.marketplace}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-serif text-sm font-bold">{order.value}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-serif ${order.statusStyle}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-6 py-4 font-mono text-[10px] text-[#6B7480]">{order.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
        {recommendationsLoading ? (
          <>
            <div className="h-[220px] rounded-lg border border-[#DDE5EE] bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.1)] animate-pulse" />
            <div className="h-[220px] rounded-lg border border-[#DDE5EE] bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.1)] animate-pulse" />
          </>
        ) : dashboardRecommendations.length > 0 ? (
          dashboardRecommendations.map((recommendation) => {
            const isPricing = recommendation.scenario_type.includes('price')
            const primaryLabel = getDashboardPrimaryActionLabel(recommendation.scenario_type)
            const secondaryLabel = getDashboardSecondaryActionLabel(recommendation.scenario_type)
            const busy = busyRecommendationId === recommendation.id

            return (
              <div
                key={recommendation.id}
                className="bg-white border border-[#DDE5EE] p-6 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)] flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-serif text-[10px] font-bold tracking-[0.1em] uppercase ${
                      isPricing ? 'text-[#2764FF]' : 'text-[#F22E75]'
                    }`}
                  >
                    {recommendation.scenario_type.replaceAll('_', ' ')}
                  </span>
                  <span className={isPricing ? 'text-[#2764FF]' : 'text-[#F22E75]'}>
                    {isPricing ? '★' : '⚠'}
                  </span>
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-[#03182F]">{recommendation.title}</h3>
                  <p className="font-serif text-[13px] text-[#6B7480] mt-1">{recommendation.reasoning_summary}</p>
                </div>
                <div className="mt-auto pt-4 flex gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleRecommendationAction(recommendation, 'approve')}
                    className="bg-[#2764FF] text-white px-4 py-2 rounded font-serif text-sm transition-all duration-150 ease-out hover:bg-[#004bd9] focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50 disabled:opacity-50 flex-1"
                  >
                    {busy ? 'Working…' : primaryLabel}
                  </button>
                  {isPricing ? (
                    <button
                      type="button"
                      onClick={() => router.push('/actions')}
                      className="border border-[#BFCBDA] text-[#30373E] px-4 py-2 rounded font-serif text-sm transition-all duration-150 ease-out hover:bg-[#F2F8FF] focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50"
                    >
                      {secondaryLabel}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRecommendationAction(recommendation, 'reject')}
                      className="border border-[#BFCBDA] text-[#30373E] px-4 py-2 rounded font-serif text-sm transition-all duration-150 ease-out hover:bg-[#F2F8FF] focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50 disabled:opacity-50"
                    >
                      {secondaryLabel}
                    </button>
                  )}
                </div>
              </div>
            )
          })
        ) : (
          <div className="md:col-span-2 rounded-lg border border-dashed border-[#BFCBDA] bg-white p-6 text-center shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
            <p className="font-serif text-base font-bold text-[#03182F]">No pending Leia decisions</p>
            <p className="mt-2 font-serif text-[13px] text-[#6B7480]">
              Ask Leia for an operational recommendation or review the full ledger in Actions.
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="rounded bg-[#2764FF] px-4 py-2 font-serif text-sm text-white transition-all duration-150 ease-out hover:bg-[#004bd9] focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50"
              >
                Ask Leia
              </button>
              <button
                type="button"
                onClick={() => router.push('/actions')}
                className="rounded border border-[#BFCBDA] px-4 py-2 font-serif text-sm text-[#30373E] transition-all duration-150 ease-out hover:bg-[#F2F8FF] focus:outline-none focus:ring-2 focus:ring-[#2764FF]/50"
              >
                Open Actions
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
