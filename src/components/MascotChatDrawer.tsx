'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Send, Sparkles } from 'lucide-react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  tool_calls?: Array<{ name: string; args: unknown; result: unknown }>
}

const INTRO: ChatMessage = {
  role: 'assistant',
  content:
    "Salut 👋 Je suis Iris, je veille sur ton tableau de bord. Tu peux me demander l'état de ton stock, lister tes actions en attente, ou m'annoncer un congé — je mets tout en place pour toi.",
}

const SUGGESTIONS = [
  'Combien j\'ai de stock total ?',
  'Je pars en vacances 2 semaines à partir du 5 mai',
  'Quelles actions m\'attendent ?',
]

export default function MascotChatDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([INTRO])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return

    const next = [...messages, { role: 'user' as const, content: trimmed }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setError(null)

    try {
      const apiMessages = next.map((m) => ({ role: m.role, content: m.content }))
      const resp = await fetch('/api/mascot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      })
      const data = await resp.json()
      if (!resp.ok) {
        throw new Error(data?.error ?? 'Requête échouée')
      }
      setMessages([
        ...next,
        {
          role: 'assistant',
          content: data.message?.content ?? '…',
          tool_calls: data.tool_calls,
        },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-[min(420px,100vw)] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-pink-400 via-indigo-500 to-cyan-400 p-2 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Iris</h3>
              <p className="text-xs text-slate-500">Ta copilote Mirakl</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le chat"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
          {messages.map((m, idx) => (
            <MessageBubble key={idx} message={m} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
              Iris réfléchit…
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length <= 1 && !busy && (
          <div className="flex flex-wrap gap-2 border-t border-slate-200 bg-white px-4 py-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => sendMessage(s)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3">
          <div className="flex items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-indigo-400">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Demande à Iris…"
              rows={1}
              className="max-h-32 w-full resize-none bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Envoyer"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%] space-y-1">
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.tool_calls.map((tc, i) => (
              <span
                key={i}
                title={JSON.stringify(tc.args)}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700"
              >
                🔧 {tc.name}
              </span>
            ))}
          </div>
        )}
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
            isUser
              ? 'bg-indigo-600 text-white'
              : 'border border-slate-200 bg-white text-slate-800'
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  )
}
