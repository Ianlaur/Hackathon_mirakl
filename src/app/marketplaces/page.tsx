'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Store, Mail, ArrowRight, Paperclip, Send, X, Check, Download } from 'lucide-react'

type Tab = 'proposals' | 'active'

type Connector = {
  channel: string
  name: string
  icon: string
  orders_30d: number
  revenue_30d_cents: number
  previous_revenue_cents: number
  delta_pct: number
  status: 'STABLE' | 'REVIEW'
}

type Requirement = {
  id: string
  label: string
  status: 'ok' | 'warn' | 'pending' | 'fail'
  position: number
}

type Proposal = {
  id: string
  name: string
  category: string | null
  daily_users: string | null
  last_year_revenue: string | null
  status: string
  about: string | null
  match_score: number | null
  risk_signal: string | null
  requirements: Requirement[]
}

type Message = {
  id: string
  sender: 'founder' | 'counterpart' | 'mira' | string
  body: string
  autopilot: boolean
  created_at: string
}

type Dialogue = {
  id: string
  counterpart_name: string
  last_message_preview: string | null
  last_message_at: string | null
  proposal: Pick<Proposal, 'id' | 'name' | 'category' | 'daily_users' | 'last_year_revenue' | 'about' | 'match_score' | 'risk_signal' | 'status'> | null
  messages: Message[]
}

// Static smart suggestions — editorial copy, not data-driven. Kept as-is.
const suggestions = [
  { name: 'Vente-privee', desc: 'Ideal for clearance of high-end furniture stock.' },
  { name: 'Wayfair', desc: 'Strong alignment with your upholstery product category.' },
  { name: 'Home24', desc: 'Growth opportunity in the DACH furniture market.' },
]

function formatEur(cents: number) {
  const euros = cents / 100
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(euros)
  } catch {
    return `€${euros.toFixed(0)}`
  }
}

function formatDelta(pct: number) {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

function formatRelative(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffH = diffMs / 3_600_000
  if (diffH < 1) return `${Math.max(1, Math.round(diffMs / 60_000))}m`
  if (diffH < 24) return `${Math.round(diffH)}h`
  if (diffH < 48) return 'YESTERDAY'
  return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
}

function ProposalsTab({
  connectors,
  proposals,
  loading,
  onDecide,
  onMessage,
}: {
  connectors: Connector[]
  proposals: Proposal[]
  loading: boolean
  onDecide: (id: string, action: 'accept' | 'decline') => void
  onMessage: (proposalId: string) => void
}) {
  const pendingProposals = proposals.filter((p) => p.status === 'pending')

  return (
    <div className="space-y-6">
      {/* Connected Marketplaces */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Connected Marketplaces</h3>
          <span className="font-mono text-[10px] text-[#2764ff] font-bold">
            {loading ? '…' : `${connectors.length} ACTIVE CHANNELS`}
          </span>
        </div>
        {loading && connectors.length === 0 ? (
          <p className="rounded border border-dashed border-[#BFCBDA] bg-white p-4 text-sm text-[#6B7480]">Loading connected marketplaces…</p>
        ) : connectors.length === 0 ? (
          <p className="rounded border border-dashed border-[#BFCBDA] bg-white p-4 text-sm text-[#6B7480]">No active channels yet. Ingest orders or connect Shopify.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {connectors.map((mp) => {
              const neg = mp.delta_pct < 0
              return (
                <div key={mp.channel} className="bg-white border border-[#DDE5EE] p-5 rounded hover:shadow-md transition-all duration-300">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-10 h-10 bg-white rounded flex items-center justify-center border border-slate-100 text-xl">{mp.icon}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${mp.status === 'STABLE' ? 'bg-[#3FA46A]/10 text-[#3FA46A]' : 'bg-[#FFE7EC] text-[#F22E75]'}`}>{mp.status}</span>
                  </div>
                  <h4 className="font-serif text-base font-bold text-[#03182F]">{mp.name}</h4>
                  <p className="text-[12px] text-[#6B7480]">Revenue (30d)</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-serif text-[22px] font-bold text-[#03182F]">{formatEur(mp.revenue_30d_cents)}</span>
                    <span className={`font-mono text-[10px] ${neg ? 'text-[#F22E75]' : 'text-[#3FA46A]'}`}>{formatDelta(mp.delta_pct)}</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center">
                    <svg className={`w-24 h-6 ${neg ? 'text-[#F22E75]' : 'text-[#3FA46A]'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 100 20">
                      <path d={neg ? 'M0 5 L20 8 L40 6 L60 12 L80 15 L100 18' : 'M0 18 L20 12 L40 10 L60 5 L80 8 L100 2'} />
                    </svg>
                    <span className="font-mono text-[10px] text-[#6B7480]">{mp.orders_30d} orders</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* New Proposals — Mirakl Connect API feed */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">New Proposals</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#E9F0FF] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#2764FF]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2764FF]" />
              via Mirakl Connect
            </span>
          </div>
          <button className="text-[13px] text-[#004bd9] font-bold hover:underline">VIEW ALL PROPOSALS</button>
        </div>
        {loading && pendingProposals.length === 0 ? (
          <p className="rounded border border-dashed border-[#BFCBDA] bg-white p-4 text-sm text-[#6B7480]">Loading proposals…</p>
        ) : pendingProposals.length === 0 ? (
          <p className="rounded border border-dashed border-[#BFCBDA] bg-white p-4 text-sm text-[#6B7480]">No pending proposals right now.</p>
        ) : (
          <div className="space-y-4">
            {pendingProposals.map((p) => (
              <div key={p.id} className="bg-white border border-[#DDE5EE] p-4 flex items-center hover:bg-slate-50 transition-colors">
                <div className="w-12 h-12 bg-white flex-shrink-0 flex items-center justify-center border border-slate-200 p-2 rounded">
                  <Store className="h-6 w-6 text-[#6B7480]" />
                </div>
                <div className="ml-6 flex-1 grid grid-cols-4 items-center">
                  <div>
                    <h4 className="font-serif text-lg font-bold text-[#03182F]">{p.name}</h4>
                    <p className="text-[12px] text-[#6B7480]">{p.category ?? '—'}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-[10px] tracking-[0.1em] text-[#6B7480] uppercase">DAILY USERS</p>
                    <p className="font-serif text-lg font-bold text-[#03182F]">{p.daily_users ?? '—'}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-[10px] tracking-[0.1em] text-[#6B7480] uppercase">LAST YEAR REVENUE</p>
                    <p className="font-serif text-lg font-bold text-[#03182F]">{p.last_year_revenue ?? '—'}</p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onDecide(p.id, 'decline')}
                      className="h-9 w-9 bg-[#ba1a1a] text-white hover:bg-[#ba1a1a]/90 transition-colors rounded shadow-sm flex items-center justify-center"
                      aria-label="Decline"
                      title="Decline"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onMessage(p.id)}
                      className="h-9 w-9 bg-[#004bd9] text-white hover:bg-[#004bd9]/90 transition-colors rounded shadow-sm flex items-center justify-center"
                      aria-label="Message"
                      title="Open conversation"
                    >
                      <Mail className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDecide(p.id, 'accept')}
                      className="h-9 w-9 bg-[#3FA46A] text-white hover:bg-[#3FA46A]/90 transition-colors rounded shadow-sm flex items-center justify-center"
                      aria-label="Accept"
                      title="Accept"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Smart Suggestions — editorial, not data-driven */}
      <section className="pb-12">
        <div className="flex items-center gap-2 mb-6">
          <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Smart Suggestions</h3>
          <div className="flex-1 h-px bg-slate-100" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {suggestions.map((s) => (
            <div key={s.name} className="bg-white border border-dashed border-[#BFCBDA] p-5 flex flex-col items-center text-center rounded-lg hover:border-[#004bd9] transition-all">
              <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
                <Store className="h-8 w-8 text-slate-300" />
              </div>
              <h5 className="font-serif text-base font-bold text-[#03182F]">{s.name}</h5>
              <p className="text-[12px] text-[#6B7480] mt-1 px-4">{s.desc}</p>
              <button className="mt-4 text-xs font-bold text-[#004bd9] flex items-center gap-1 hover:gap-2 transition-all">
                EXPLORE MATCH <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function ActiveConnectionTab({
  dialogues,
  loading,
  onSend,
  focusProposalId,
  onFocusConsumed,
}: {
  dialogues: Dialogue[]
  loading: boolean
  onSend: (dialogueId: string, body: string) => Promise<void>
  focusProposalId?: string | null
  onFocusConsumed?: () => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(dialogues[0]?.id ?? null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (selectedId && !dialogues.some((d) => d.id === selectedId)) {
      setSelectedId(dialogues[0]?.id ?? null)
    } else if (!selectedId && dialogues[0]?.id) {
      setSelectedId(dialogues[0].id)
    }
  }, [dialogues, selectedId])

  // When Proposals' Message button asks to focus a specific proposal's dialogue.
  useEffect(() => {
    if (!focusProposalId) return
    const match = dialogues.find((d) => d.proposal?.id === focusProposalId)
    if (match) setSelectedId(match.id)
    onFocusConsumed?.()
  }, [focusProposalId, dialogues, onFocusConsumed])

  const selected = useMemo(
    () => dialogues.find((d) => d.id === selectedId) ?? null,
    [dialogues, selectedId],
  )

  const handleSend = useCallback(async () => {
    const body = draft.trim()
    if (!selected || !body || sending) return
    setSending(true)
    try {
      await onSend(selected.id, body)
      setDraft('')
    } finally {
      setSending(false)
    }
  }, [draft, selected, sending, onSend])

  if (loading && dialogues.length === 0) {
    return (
      <div className="border border-[#DDE5EE] bg-white rounded p-10 text-center text-sm text-[#6B7480]">
        Loading conversations…
      </div>
    )
  }

  if (dialogues.length === 0) {
    return (
      <div className="border border-[#DDE5EE] bg-white rounded p-10 text-center text-sm text-[#6B7480]">
        Aucune conversation active. Accepte une proposition pour démarrer un dialogue.
      </div>
    )
  }

  return (
    <div className="flex border border-[#DDE5EE] bg-white rounded overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
      {/* Left: Conversation list */}
      <aside className="w-80 border-r border-slate-200 flex flex-col overflow-y-auto flex-shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase">Active Proposals</h3>
        </div>
        <div className="flex-grow">
          {dialogues.map((c) => {
            const active = selectedId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`w-full p-4 text-left transition-colors ${
                  active
                    ? 'bg-[#dce1ff]/30 border-l-4 border-[#004bd9]'
                    : 'hover:bg-slate-50 border-l-4 border-transparent'
                }`}
              >
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                    <Store className="h-5 w-5 text-[#6B7480]" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-serif text-sm font-bold text-[#03182F]">{c.counterpart_name}</span>
                      <span className="text-[10px] font-mono text-[#6B7480] uppercase">{formatRelative(c.last_message_at)}</span>
                    </div>
                    <p className="text-[12px] text-[#6B7480] truncate italic">{c.last_message_preview ?? '…'}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      {/* Center: Chat */}
      <article className="flex-grow flex flex-col">
        <header className="p-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center">
              <Store className="h-5 w-5 text-[#6B7480]" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-[#03182F]">{selected?.counterpart_name ?? '—'}</h2>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#3FA46A]" />
                <span className="text-[10px] font-mono text-[#6B7480] uppercase">Proposing Partner · Online</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="h-9 px-4 flex items-center gap-2 border border-[#BFCBDA] text-[#30373E] text-[11px] font-bold rounded hover:bg-slate-50 transition-colors uppercase">
              <X className="h-3.5 w-3.5" /> Decline
            </button>
            <button className="h-9 px-4 flex items-center gap-2 bg-[#3FA46A] text-white text-[11px] font-bold rounded hover:opacity-90 transition-opacity uppercase shadow-sm">
              <Check className="h-3.5 w-3.5" /> Accept
            </button>
            <button className="h-9 px-4 flex items-center gap-2 bg-[#004bd9] text-white text-[11px] font-bold rounded hover:opacity-90 transition-opacity uppercase shadow-sm">
              <Download className="h-3.5 w-3.5" /> Install
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-grow overflow-y-auto p-6 space-y-8 bg-[#faf8ff]">
          {(selected?.messages ?? []).map((msg) => {
            if (msg.sender === 'mira') {
              return (
                <div key={msg.id} className="flex gap-4 max-w-2xl ml-auto flex-row-reverse">
                  <div className="w-8 h-8 rounded-full bg-[#03182F] flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">AI</div>
                  <div className="space-y-1 text-right">
                    <div className="bg-[#004bd9] text-white p-4 rounded-xl rounded-tr-none shadow-sm">
                      <p className="text-sm">{msg.body}</p>
                    </div>
                    <span className="text-[10px] font-mono text-[#6B7480] uppercase mr-1">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {msg.autopilot ? ' · AUTOPILOT' : ''}
                    </span>
                  </div>
                </div>
              )
            }
            const isFounder = msg.sender === 'founder'
            return (
              <div key={msg.id} className={`flex gap-4 max-w-2xl ${isFounder ? 'ml-auto flex-row-reverse' : ''}`}>
                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex-shrink-0 flex items-center justify-center">
                  <Store className="h-4 w-4 text-[#6B7480]" />
                </div>
                <div className={`space-y-1 ${isFounder ? 'text-right' : ''}`}>
                  <div className={`p-4 rounded-xl shadow-sm ${isFounder ? 'bg-[#F2F8FF] border border-[#2764FF]/20 rounded-tr-none' : 'bg-white border border-[#DDE5EE] rounded-tl-none'}`}>
                    <p className="text-sm text-[#30373E]">{msg.body}</p>
                  </div>
                  <span className={`text-[10px] font-mono text-[#6B7480] uppercase ${isFounder ? 'mr-1' : 'ml-1'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Input */}
        <footer className="p-4 bg-white border-t border-slate-100 flex-shrink-0">
          <div className="flex gap-3 items-center bg-[#03182F] rounded-full p-1.5 pl-4 shadow-lg">
            <button className="text-[#6B7480] hover:text-white transition-colors">
              <Paperclip className="h-5 w-5" />
            </button>
            <input
              className="flex-grow bg-transparent border-none text-white text-sm focus:ring-0 focus:outline-none placeholder:text-[#6B7480] font-serif"
              placeholder={selected ? `Type your message to ${selected.counterpart_name} team…` : 'Select a conversation'}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void handleSend()
                }
              }}
              disabled={!selected || sending}
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!selected || !draft.trim() || sending}
              className="bg-[#004bd9] text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#2764FF] transition-colors disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </article>

      {/* Right: Info pane */}
      <aside className="w-72 border-l border-slate-200 flex flex-col overflow-y-auto flex-shrink-0">
        <div className="p-6 space-y-8">
          <div className="text-center">
            <div className="w-20 h-20 rounded-lg bg-white border border-slate-100 shadow-sm mx-auto mb-4 flex items-center justify-center">
              <Store className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="font-serif text-[22px] font-bold text-[#03182F]">{selected?.counterpart_name ?? '—'}</h3>
            <p className="text-[12px] text-[#6B7480] mt-1">{selected?.proposal?.category ?? ''}</p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 bg-[#F2F8FF] rounded-lg border border-[#DDE5EE]">
              <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase block mb-1">Daily Users</span>
              <span className="font-serif text-2xl font-bold text-[#03182F]">{selected?.proposal?.daily_users ?? '—'}</span>
            </div>
            <div className="p-4 bg-[#F2F8FF] rounded-lg border border-[#DDE5EE]">
              <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#6B7480] uppercase block mb-1">LY Revenue</span>
              <span className="font-serif text-2xl font-bold text-[#03182F]">{selected?.proposal?.last_year_revenue ?? '—'}</span>
            </div>
          </div>

          {selected?.proposal?.about ? (
            <div className="space-y-3">
              <h4 className="font-serif text-sm font-bold uppercase text-[#6B7480] tracking-wider">About</h4>
              <p className="text-[13px] text-[#6B7480] leading-relaxed">{selected.proposal.about}</p>
            </div>
          ) : null}

          {selected?.proposal?.risk_signal ? (
            <div className="p-4 bg-[#FFE7EC] rounded-lg border border-[#F22E75]/20">
              <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#F22E75] uppercase block">Risk Signal</span>
              <p className="text-[11px] text-[#F22E75] font-medium mt-1">{selected.proposal.risk_signal}</p>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

type Toast = { id: string; message: string; tone: 'success' | 'error' | 'info' } | null

export default function MarketplacesPage() {
  const [tab, setTab] = useState<Tab>('proposals')
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [dialogues, setDialogues] = useState<Dialogue[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshToken, setRefreshToken] = useState(0)
  const [toast, setToast] = useState<Toast>(null)
  const [focusDialogueForProposal, setFocusDialogueForProposal] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetch('/api/marketplaces/connected').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/marketplaces/proposals').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/marketplaces/dialogues').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([c, p, d]) => {
      if (cancelled) return
      if (c && Array.isArray(c.connectors)) setConnectors(c.connectors as Connector[])
      if (p && Array.isArray(p.proposals)) setProposals(p.proposals as Proposal[])
      if (d && Array.isArray(d.dialogues)) setDialogues(d.dialogues as Dialogue[])
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [refreshToken])

  const handleDecide = useCallback(async (id: string, action: 'accept' | 'decline') => {
    const target = proposals.find((p) => p.id === id)
    const name = target?.name ?? 'Proposal'
    const optimistic = proposals.map((p) =>
      p.id === id ? { ...p, status: action === 'accept' ? 'accepted' : 'declined' } : p,
    )
    setProposals(optimistic)
    try {
      const resp = await fetch(`/api/marketplaces/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!resp.ok) throw new Error('Request failed')
      setToast({
        id: `${Date.now()}`,
        message:
          action === 'accept'
            ? `${name} accepted — dialogue opened in Active Connections`
            : `${name} declined`,
        tone: action === 'accept' ? 'success' : 'info',
      })
    } catch {
      setToast({ id: `${Date.now()}`, message: `Could not ${action} ${name}`, tone: 'error' })
      setRefreshToken((n) => n + 1)
    }
    setRefreshToken((n) => n + 1)
  }, [proposals])

  const handleMessage = useCallback((proposalId: string) => {
    setFocusDialogueForProposal(proposalId)
    setTab('active')
  }, [])

  const handleSendMessage = useCallback(
    async (dialogueId: string, body: string) => {
      // Optimistic append
      const now = new Date().toISOString()
      const tempId = `tmp-${Date.now()}`
      setDialogues((prev) =>
        prev.map((d) =>
          d.id === dialogueId
            ? {
                ...d,
                last_message_preview: body.slice(0, 120),
                last_message_at: now,
                messages: [...d.messages, { id: tempId, sender: 'founder', body, autopilot: false, created_at: now }],
              }
            : d,
        ),
      )
      try {
        await fetch(`/api/marketplaces/dialogues/${dialogueId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body, sender: 'founder' }),
        })
        setRefreshToken((n) => n + 1)
      } catch {
        setRefreshToken((n) => n + 1)
      }
    },
    [],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">Marketplaces Overview</h1>
          <p className="text-[#6B7480] text-sm mt-1">Manage your active channels and discover new expansion opportunities.</p>
        </div>
        <button className="h-9 px-4 bg-[#004bd9] text-white text-[13px] font-semibold rounded hover:bg-[#004bd9]/90 transition-colors flex items-center gap-2">
          <span className="text-sm">+</span> New Channel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#DDE5EE]">
        <button
          type="button"
          onClick={() => setTab('proposals')}
          className={`px-4 py-2.5 text-sm font-serif font-medium transition-colors relative ${
            tab === 'proposals' ? 'text-[#004bd9]' : 'text-[#6B7480] hover:text-[#03182F]'
          }`}
        >
          Integration Proposals
          {tab === 'proposals' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#004bd9]" />}
        </button>
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`px-4 py-2.5 text-sm font-serif font-medium transition-colors relative ${
            tab === 'active' ? 'text-[#004bd9]' : 'text-[#6B7480] hover:text-[#03182F]'
          }`}
        >
          Active Connections
          {tab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#004bd9]" />}
        </button>
      </div>

      {/* Tab content */}
      {tab === 'proposals' && (
        <ProposalsTab
          connectors={connectors}
          proposals={proposals}
          loading={loading}
          onDecide={handleDecide}
          onMessage={handleMessage}
        />
      )}
      {tab === 'active' && (
        <ActiveConnectionTab
          dialogues={dialogues}
          loading={loading}
          onSend={handleSendMessage}
          focusProposalId={focusDialogueForProposal}
          onFocusConsumed={() => setFocusDialogueForProposal(null)}
        />
      )}

      {/* Toast */}
      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 font-serif text-[13px] font-semibold shadow-[0_10px_30px_rgba(3,24,47,0.22)] ${
            toast.tone === 'success'
              ? 'bg-[#03182F] text-white'
              : toast.tone === 'error'
                ? 'bg-[#ba1a1a] text-white'
                : 'bg-[#F2F8FF] text-[#03182F] border border-[#DDE5EE]'
          }`}
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  )
}
