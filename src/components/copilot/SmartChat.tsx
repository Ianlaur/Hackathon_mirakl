'use client'

import { SendHorizontal } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import SuggestionChips from '@/components/copilot/SuggestionChips'
import type { ChatMessage } from '@/types/copilot'

const FALLBACK_QUESTIONS = [
  'Quelles sont les urgences ce matin ?',
  'Quel stock verifier en premier ?',
  'Quelles commandes sont sensibles ?',
  'Que faut-il faire avant midi ?',
  'Quel risque surveiller aujourd hui ?',
]

function nowIso() {
  return new Date().toISOString()
}

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    createdAt: nowIso(),
  }
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function SmartChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>(FALLBACK_QUESTIONS)

  const lastHistory = useMemo(() => messages.slice(-6), [messages])

  useEffect(() => {
    let cancelled = false

    async function loadSuggestions() {
      try {
        const response = await fetch('/api/dust/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'suggestions' }),
        })

        const payload = await response.json().catch(() => ({}))
        const questions = Array.isArray(payload?.questions)
          ? payload.questions.filter((item: unknown) => typeof item === 'string').slice(0, 5)
          : []

        if (!cancelled && questions.length > 0) {
          setSuggestions(questions)
        }
      } catch {
        // Keep fallback questions.
      }
    }

    void loadSuggestions()

    return () => {
      cancelled = true
    }
  }, [])

  async function askQuestion(rawQuestion: string) {
    const question = rawQuestion.trim()
    if (!question || loading) return

    setLoading(true)
    setSelectedQuestion(question)

    const userMessage = createMessage('user', question)
    const optimisticHistory = [...lastHistory, userMessage].slice(-6)
    setMessages((current) => [...current, userMessage])

    try {
      const response = await fetch('/api/dust/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, history: optimisticHistory }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload?.error || 'Request failed')

      const result = typeof payload?.result === 'string' ? payload.result.trim() : ''

      setMessages((current) => [
        ...current,
        createMessage(
          'assistant',
          result || 'Je n ai pas pu recuperer un retour utile. Essayez une autre question.'
        ),
      ])
      setInput('')
    } catch {
      setMessages((current) => [
        ...current,
        createMessage('assistant', 'Impossible de recuperer vos donnees, reessayez.'),
      ])
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    await askQuestion(input)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <header>
        <h2 className="text-lg font-semibold text-slate-900">Copilot Mira</h2>
        <p className="mt-1 text-sm text-slate-600">
          Posez une question ou choisissez-en une ci-dessous.
        </p>
      </header>

      <div className="mt-4">
        <SuggestionChips
          suggestions={suggestions}
          selected={selectedQuestion}
          loading={loading}
          onSelect={(question) => {
            void askQuestion(question)
          }}
        />
      </div>

      <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">Choisissez une question pour demarrer avec Copilot Mira.</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className="max-w-[85%] space-y-1">
                <p
                  className={`rounded-xl px-3 py-2 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {message.content}
                </p>
                <p className="text-[11px] text-slate-400">{formatTime(message.createdAt)}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Posez votre question a Copilot Mira..."
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Poser"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </form>
    </section>
  )
}
