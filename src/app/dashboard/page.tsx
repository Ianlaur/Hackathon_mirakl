'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Mic, Loader2, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useAudioRecorder } from '@/components/useAudioRecorder'
import { usePluginContext } from '@/contexts/PluginContext'

const GlobalShipmentTracker = dynamic(
  () => import('@/components/map/GlobalShipmentTracker'),
  {
    ssr: false,
    loading: () => <div className="h-[380px] animate-pulse rounded-xl bg-slate-900/80" />,
  }
)

const orders = [
  { id: 'MK-8829-X', marketplace: 'Amazon US', icon: '🛒', value: '$249.00', status: 'FULFILLED', statusStyle: 'text-[#3FA46A] bg-[#3FA46A]/10', time: '14:22:05' },
  { id: 'MK-8830-L', marketplace: 'Maison du Monde', icon: '🏠', value: '$1,120.45', status: 'PROCESSING', statusStyle: 'text-[#2764FF] bg-[#2764FF]/10', time: '14:18:12' },
  { id: 'MK-8831-Z', marketplace: 'Zalando EU', icon: '🌍', value: '$89.99', status: 'RISK ATTACHED', statusStyle: 'text-[#F22E75] bg-[#FFE7EC]', time: '14:05:44' },
  { id: 'MK-8832-P', marketplace: 'Carrefour', icon: '🛍️', value: '$42.50', status: 'FULFILLED', statusStyle: 'text-[#3FA46A] bg-[#3FA46A]/10', time: '13:59:30' },
]

type DashboardChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoningSummary?: string
}

export default function DashboardPage() {
  const [query, setQuery] = useState('')
  const [transcribing, setTranscribing] = useState(false)
  const [mapTheme, setMapTheme] = useState<'dark' | 'light'>('dark')
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<DashboardChatMessage[]>([])
  const [chatOpen, setChatOpen] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const recorder = useAudioRecorder()
  const { isProPluginActive } = usePluginContext()
  const recording = recorder.state === 'recording'
  const starting = recorder.state === 'requesting'

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
    setChatMessages((current) => [...current, userMessage])

    try {
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          message,
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
        },
      ])
      setQuery('')
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Failed to contact Leia.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">Dashboard</h1>
        <div className="font-serif text-[12px] text-[#6B7480]">Last sync: 2 minutes ago</div>
      </div>

      {/* Leia launcher */}
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

      <div
        className={`iris-overlay ${chatOpen ? 'iris-overlay--open' : 'iris-overlay--closed'}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) setChatOpen(false)
        }}
        aria-hidden={!chatOpen}
      >
        <div className={`iris-panel ${chatOpen ? 'iris-panel--open' : 'iris-panel--closed'}`}>
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
              onChange={(e) => setQuery(e.target.value)}
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

          {(chatMessages.length > 0 || chatError || sending) && (
            <div ref={scrollRef} className="iris-conversation">
              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`iris-msg ${message.role === 'assistant' ? 'iris-msg--assistant' : 'iris-msg--user'}`}
                >
                  <div className="iris-msg__bubble font-serif whitespace-pre-wrap">{message.content}</div>
                  {message.role === 'assistant' && message.reasoningSummary ? (
                    <p className="mt-1 rounded border border-[#DDE5EE] bg-[#F2F8FF] px-3 py-2 font-serif text-[12px] text-[#30373E]">
                      {message.reasoningSummary}
                    </p>
                  ) : null}
                </div>
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
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Orders Today */}
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

        {/* Active SKUs */}
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

        {/* Stock Health */}
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
          <button className="text-[#2764FF] font-serif text-sm font-medium hover:underline">View all orders</button>
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
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-white transition-colors">
                <td className="px-6 py-4 font-mono text-[14px] text-[#03182F]">{o.id}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#F2F8FF] flex items-center justify-center text-sm">{o.icon}</div>
                    <span className="font-serif text-sm">{o.marketplace}</span>
                  </div>
                </td>
                <td className="px-6 py-4 font-serif text-sm font-bold">{o.value}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-serif ${o.statusStyle}`}>{o.status}</span>
                </td>
                <td className="px-6 py-4 font-mono text-[10px] text-[#6B7480]">{o.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Decision Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
        {/* Stock Out Risk */}
        <div className="bg-white border border-[#DDE5EE] p-6 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#F22E75] uppercase">STOCK OUT RISK</span>
            <span className="text-[#F22E75]">&#9888;</span>
          </div>
          <div>
            <h3 className="font-serif text-base font-bold text-[#03182F]">Linum Cushion (Blue)</h3>
            <p className="font-serif text-[13px] text-[#6B7480] mt-1">Inventory will deplete in 48 hours at current velocity. Suggested restock: 45 units.</p>
          </div>
          <div className="mt-auto pt-4 flex gap-3">
            <button className="bg-[#2764FF] text-white px-4 py-2 rounded font-serif text-sm hover:bg-[#004bd9] transition-colors flex-1">Approve Restock</button>
            <button className="border border-[#BFCBDA] text-[#30373E] px-4 py-2 rounded font-serif text-sm hover:bg-[#F2F8FF] transition-colors">Ignore</button>
          </div>
        </div>

        {/* Marketplace Insight */}
        <div className="bg-white border border-[#DDE5EE] p-6 rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#2764FF] uppercase">LEIA INSIGHT</span>
            <span className="text-[#2764FF]">&#9733;</span>
          </div>
          <div>
            <h3 className="font-serif text-base font-bold text-[#03182F]">Optimized Pricing on Zalando</h3>
            <p className="font-serif text-[13px] text-[#6B7480] mt-1">Competitors have adjusted prices in Home &amp; Decor. Dropping price by $2.00 could increase volume by 15%.</p>
          </div>
          <div className="mt-auto pt-4 flex gap-3">
            <button className="bg-[#2764FF] text-white px-4 py-2 rounded font-serif text-sm hover:bg-[#004bd9] transition-colors flex-1">Apply Price Change</button>
            <button className="border border-[#BFCBDA] text-[#30373E] px-4 py-2 rounded font-serif text-sm hover:bg-[#F2F8FF] transition-colors">Review Details</button>
          </div>
        </div>
      </div>
    </div>
  )
}
