'use client'

import { useState } from 'react'
import { Send, Mic, Loader2 } from 'lucide-react'
import { useAudioRecorder } from '@/components/useAudioRecorder'

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
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<DashboardChatMessage[]>([])
  const recorder = useAudioRecorder()
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

      {/* AI Chat Bar — light variant with voice mode */}
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
