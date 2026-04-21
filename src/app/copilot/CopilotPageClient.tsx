'use client'

import Link from 'next/link'
import { BarChart3, Bot, Package, Send, Settings2, Sparkles, Truck } from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'

type CopilotConfig = {
  apiKeyConfigured: boolean
  apiKeyHint: string | null
  preferredModel: string
  autonomyMode: string
}

type ChatMessage = {
  id: string
  role: string
  content: string
  reasoning_summary: string | null
  evidence_payload: Array<{ label: string; value: string }> | null | any
  created_at: string
}

type ChatSession = {
  id: string
  title: string
  last_message_at: string
  messages: ChatMessage[]
}

type Recommendation = {
  id: string
  title: string
  scenario_type: string
  status: string
  reasoning_summary: string
  expected_impact: string | null
  confidence_note: string | null
  evidence_payload: Array<{ label: string; value: string }> | null | any
  action_payload: any
  created_at: string
  approvals: Array<{ id: string; status: string; comment: string | null; created_at: string }>
  execution_runs: Array<{ id: string; status: string; result_summary: string | null; created_at: string }>
}

type Execution = {
  id: string
  target: string
  status: string
  result_summary: string | null
  created_at: string
}

export default function CopilotPageClient({
  config,
  sessions,
  recommendations: initialRecommendations,
  executions,
}: {
  config: CopilotConfig
  sessions: ChatSession[]
  recommendations: Recommendation[]
  executions: Execution[]
}) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessions[0]?.id || null)
  const [chatInput, setChatInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recommendations, setRecommendations] = useState(initialRecommendations)
  const [chatSessions, setChatSessions] = useState(sessions)

  const activeSession = useMemo(
    () => chatSessions.find((session) => session.id === activeSessionId) || null,
    [chatSessions, activeSessionId]
  )

  const pendingActions = recommendations.filter(
    (recommendation) => recommendation.status === 'pending_approval'
  ).length

  async function sendMessage(rawMessage: string) {
    const message = rawMessage.trim()
    if (!message || isSending) return

    setIsSending(true)
    setError(null)

    try {
      const optimisticMessage = {
        id: `tmp-${Date.now()}`,
        role: 'user',
        content: message,
        reasoning_summary: null,
        evidence_payload: null,
        created_at: new Date().toISOString(),
      }

      if (activeSession) {
        setChatSessions((current) =>
          current.map((session) =>
            session.id === activeSession.id
              ? { ...session, messages: [...session.messages, optimisticMessage] }
              : session
          )
        )
      }

      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId || undefined,
          message,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      setChatInput('')

      setChatSessions((current) => {
        const nextSessions = [...current]
        const existingIndex = nextSessions.findIndex((session) => session.id === data.sessionId)

        if (existingIndex === -1) {
          nextSessions.unshift({
            id: data.sessionId,
            title: message.slice(0, 60),
            last_message_at: new Date().toISOString(),
            messages: [
              optimisticMessage,
              {
                ...data.message,
                evidence_payload: data.message.evidence_payload || [],
              },
            ],
          })
        } else {
          const existing = nextSessions[existingIndex]
          nextSessions[existingIndex] = {
            ...existing,
            last_message_at: new Date().toISOString(),
            messages: [
              ...existing.messages.filter((chatMessage) => chatMessage.id !== optimisticMessage.id),
              optimisticMessage,
              {
                ...data.message,
                evidence_payload: data.message.evidence_payload || [],
              },
            ],
          }
        }

        return nextSessions
      })

      setActiveSessionId(data.sessionId)

      if (data.recommendations?.length) {
        setRecommendations((current) => [
          ...data.recommendations.map((recommendation: Recommendation) => ({
            ...recommendation,
            approvals: [],
            execution_runs: [],
            evidence_payload: recommendation.evidence_payload || [],
          })),
          ...current,
        ])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsSending(false)
    }
  }

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault()
    await sendMessage(chatInput)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="dashboard-card p-6 sm:p-8">
        <div className="space-y-4">
          <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
            Merchant Ops Copilot
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
              Explainable operations chat with approval-gated actions
            </h1>
            <p className="max-w-4xl text-base leading-7 text-slate-600">
              Gerez vos operations sereinement grace a vos Agents Dust. Posez une question ou
              lancez une action rapide, l&apos;IA s&apos;occupe du reste.
            </p>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="dashboard-card p-6 sm:p-8">
            <div className="mx-auto max-w-4xl">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void sendMessage('Fais-moi un resume de la semaine en cours.')}
                  disabled={isSending}
                  className="group col-span-1 rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5 text-left transition hover:-translate-y-0.5 hover:border-cyan-300 hover:bg-cyan-100/80 hover:shadow-md disabled:opacity-60 sm:col-span-2 sm:mx-auto sm:w-[78%]"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-600 text-white">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900">📊 Resume de la semaine</p>
                  <p className="mt-1 text-sm text-slate-600">Generer un rapport d&apos;activite</p>
                </button>

                <button
                  type="button"
                  onClick={() => void sendMessage("Donne-moi l'etat de mon stock et les alertes.")}
                  disabled={isSending}
                  className="group rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-left transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100/80 hover:shadow-md disabled:opacity-60"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
                    <Package className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900">📦 Etat de mon stock</p>
                  <p className="mt-1 text-sm text-slate-600">Verifier les alertes</p>
                </button>

                <button
                  type="button"
                  onClick={() => void sendMessage('Montre-moi le statut actuel de mes commandes.')}
                  disabled={isSending}
                  className="group rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 text-left transition hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-indigo-100/80 hover:shadow-md disabled:opacity-60"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white">
                    <Truck className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900">🚛 Statut des commandes</p>
                  <p className="mt-1 text-sm text-slate-600">Voir les expeditions en cours</p>
                </button>
              </div>
            </div>
          </section>

          <section className="dashboard-card overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Conversation avec vos agents</h2>
                  <p className="text-sm text-slate-500">
                    Une interface simple pour piloter vos operations sans effort.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSessionId(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  Nouvelle discussion
                </button>
              </div>

              {chatSessions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {chatSessions.slice(0, 4).map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setActiveSessionId(session.id)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        activeSessionId === session.id
                          ? 'bg-cyan-100 text-cyan-700 ring-1 ring-cyan-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {session.title}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="h-[360px] space-y-4 overflow-y-auto bg-white px-5 py-5">
              {activeSession?.messages?.length ? (
                activeSession.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                      message.role === 'assistant'
                        ? 'bg-slate-100 text-slate-800'
                        : 'ml-auto bg-cyan-600 text-white'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                  Discutez avec vos agents pour suivre votre activite, vos stocks et vos commandes.
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-slate-200 bg-slate-50 p-4">
              <div className="flex items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3">
                <textarea
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  rows={2}
                  placeholder="Discutez avec vos agents (ex: @Agent1, @Agent2)..."
                  className="w-full resize-none bg-transparent px-1 py-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={isSending || !chatInput.trim()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white transition hover:bg-slate-800 disabled:opacity-50"
                  aria-label="Envoyer"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="dashboard-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">🤖 Vos Agents Dust</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Vos assistants pour vous aider au quotidien.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                <Sparkles className="h-3.5 w-3.5" />
                Powered by Dust
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {['Agent 1', 'Agent 2', 'Agent 3'].map((agent) => (
                <div
                  key={agent}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-800">
                    <Bot className="h-4 w-4 text-slate-500" />
                    {agent}
                  </span>
                  <span className="text-xs text-emerald-600">Disponible</span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-100 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Actions</p>
                <p className="text-lg font-semibold text-slate-900">{pendingActions}</p>
              </div>
              <div className="rounded-xl bg-slate-100 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Executions</p>
                <p className="text-lg font-semibold text-slate-900">{executions.length}</p>
              </div>
            </div>
          </section>

          <details className="dashboard-card p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-700">
              <span className="inline-flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Parametres techniques
              </span>
              <span className="text-xs text-slate-400">Avance</span>
            </summary>

            <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <p>API key: {config.apiKeyConfigured ? config.apiKeyHint || 'Configuree' : 'Missing'}</p>
              <p>Model: {config.preferredModel}</p>
              <p>Autonomy: {config.autonomyMode}</p>
              <Link
                href="/settings"
                className="mt-2 inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Ouvrir les parametres
              </Link>
            </div>
          </details>
        </aside>
      </section>
    </div>
  )
}
