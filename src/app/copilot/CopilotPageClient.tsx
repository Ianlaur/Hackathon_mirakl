'use client'

import Link from 'next/link'
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

function statusTone(status: string) {
  if (status === 'approved' || status === 'completed') return 'bg-emerald-50 text-emerald-700'
  if (status === 'rejected' || status === 'failed') return 'bg-rose-50 text-rose-700'
  if (status === 'queued' || status === 'executing') return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-700'
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

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault()
    if (!chatInput.trim()) return

    setIsSending(true)
    setError(null)

    try {
      const optimisticMessage = {
        id: `tmp-${Date.now()}`,
        role: 'user',
        content: chatInput.trim(),
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
          message: chatInput.trim(),
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
            title: chatInput.trim().slice(0, 60),
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
              ...existing.messages.filter((message) => message.id !== optimisticMessage.id),
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

  async function handleDecision(id: string, action: 'approve' | 'reject') {
    setError(null)

    try {
      const response = await fetch(`/api/copilot/recommendations/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} recommendation`)
      }

      setRecommendations((current) =>
        current.map((recommendation) =>
          recommendation.id === id
            ? {
                ...recommendation,
                status: data.recommendation.status,
              }
            : recommendation
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="dashboard-card overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.8fr] lg:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Merchant Ops Copilot
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-950">
                Explainable operations chat with approval-gated actions
              </h1>
              <p className="max-w-3xl text-base leading-7 text-slate-600">
                Ask about stock risk, parcel delays, planning events, or external context. The copilot reads your merchant data, shows its reasoning, and stages actions for approval.
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-950 p-5 text-white">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Control model</p>
            <div className="mt-5 space-y-3 text-sm text-slate-300">
              <p>API key: {config.apiKeyConfigured ? config.apiKeyHint || 'Configured' : 'Missing'}</p>
              <p>Model: {config.preferredModel}</p>
              <p>Autonomy: {config.autonomyMode}</p>
              <Link href="/settings" className="inline-flex rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-950">
                Update settings
              </Link>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.4fr_1fr]">
        <div className="dashboard-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Sessions</h2>
            <button
              onClick={() => setActiveSessionId(null)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600"
            >
              New chat
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {chatSessions.length === 0 ? (
              <p className="text-sm text-slate-500">No session yet. Start by asking the copilot a question.</p>
            ) : (
              chatSessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    activeSessionId === session.id
                      ? 'border-cyan-300 bg-cyan-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{session.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(session.last_message_at).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="dashboard-card flex min-h-[620px] flex-col overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-950">Copilot chat</h2>
            <p className="text-sm text-slate-500">
              Grounded in stock, transport, warehouse, calendar, and external context data.
            </p>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {activeSession?.messages?.length ? (
              activeSession.messages.map((message) => (
                <div
                  key={message.id}
                  className={`rounded-2xl px-4 py-3 ${
                    message.role === 'assistant' ? 'bg-slate-100 text-slate-800' : 'bg-cyan-600 text-white'
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
                    {message.role}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  {message.reasoning_summary && (
                    <div className="mt-3 rounded-xl border border-slate-200/70 bg-white/80 p-3 text-slate-700">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Reasoning
                      </p>
                      <p className="mt-2 text-sm leading-6">{message.reasoning_summary}</p>
                      {message.evidence_payload?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.evidence_payload.map((item, index) => (
                            <span
                              key={`${message.id}-${index}`}
                              className="rounded-full bg-slate-950 px-3 py-1 text-xs text-white"
                            >
                              {item.label}: {item.value}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                Ask something like “What should I restock this week?”, “Which parcels threaten customer commitments?”, or “How do my planning events affect stock?”
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="border-t border-slate-200 p-5">
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              rows={4}
              placeholder="Ask the merchant copilot about stock, transport, demand events, or planning."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none ring-0 focus:border-cyan-400"
            />
            <div className="mt-3 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Approvals are required before any recommended action moves downstream.
              </p>
              <button
                type="submit"
                disabled={isSending || !chatInput.trim()}
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {isSending ? 'Thinking...' : 'Send'}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="dashboard-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Approval queue</h2>
            <div className="mt-4 space-y-3">
              {recommendations.length === 0 ? (
                <p className="text-sm text-slate-500">No recommendations yet.</p>
              ) : (
                recommendations.map((recommendation) => (
                  <div key={recommendation.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{recommendation.title}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                          {recommendation.scenario_type}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(recommendation.status)}`}>
                        {recommendation.status}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-600">{recommendation.reasoning_summary}</p>

                    {recommendation.expected_impact && (
                      <p className="mt-2 text-sm text-slate-600">
                        Impact: {recommendation.expected_impact}
                      </p>
                    )}

                    {recommendation.evidence_payload?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {recommendation.evidence_payload.map((item, index) => (
                          <span key={`${recommendation.id}-${index}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                            {item.label}: {item.value}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {recommendation.status === 'pending_approval' ? (
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => handleDecision(recommendation.id, 'approve')}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDecision(recommendation.id, 'reject')}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="dashboard-card p-5">
            <h2 className="text-lg font-semibold text-slate-950">Execution history</h2>
            <div className="mt-4 space-y-3">
              {executions.length === 0 ? (
                <p className="text-sm text-slate-500">No execution runs recorded yet.</p>
              ) : (
                executions.map((execution) => (
                  <div key={execution.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{execution.target}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone(execution.status)}`}>
                        {execution.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {execution.result_summary || 'Awaiting downstream processing.'}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {new Date(execution.created_at).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
