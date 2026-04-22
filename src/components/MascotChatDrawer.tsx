'use client'

import { useEffect, useRef, useState } from 'react'
import { X, ArrowUp, Sparkles } from 'lucide-react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  tool_calls?: Array<{ name: string; args: unknown; result: unknown }>
}

const SUGGESTIONS = [
  "Combien j'ai de stock total ?",
  'Je pars en vacances 2 semaines à partir du 5 mai',
  "Quelles actions m'attendent ?",
  'Cherche mes chaises en rupture',
]

export default function MascotChatDrawer({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const isEmpty = messages.length === 0

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  useEffect(() => {
    if (!isEmpty) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy, isEmpty])

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

  const resetConversation = () => {
    setMessages([])
    setInput('')
    setError(null)
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
        className={`fixed right-0 top-0 z-50 flex h-full w-[min(460px,100vw)] flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Sparkles className="h-4 w-4 text-indigo-500" />
            <span>Iris</span>
            {!isEmpty && (
              <button
                type="button"
                onClick={resetConversation}
                className="ml-2 rounded-md px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                Nouvelle conversation
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {isEmpty ? (
          <EmptyState
            onPickSuggestion={sendMessage}
            input={input}
            setInput={setInput}
            onSubmit={handleSubmit}
            onKeyDown={handleKeyDown}
            inputRef={inputRef}
            busy={busy}
          />
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {messages.map((m, idx) => (
                <MessageBubble key={idx} message={m} />
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
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

            <form onSubmit={handleSubmit} className="border-t border-slate-100 px-4 py-3">
              <InputBar
                input={input}
                setInput={setInput}
                onKeyDown={handleKeyDown}
                inputRef={inputRef}
                busy={busy}
              />
            </form>
          </>
        )}
      </aside>
    </>
  )
}

function EmptyState({
  onPickSuggestion,
  input,
  setInput,
  onSubmit,
  onKeyDown,
  inputRef,
  busy,
}: {
  onPickSuggestion: (text: string) => void
  input: string
  setInput: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  inputRef: React.RefObject<HTMLTextAreaElement>
  busy: boolean
}) {
  return (
    <div className="flex flex-1 flex-col justify-center px-6 pb-24">
      <form onSubmit={onSubmit}>
        <InputBar
          input={input}
          setInput={setInput}
          onKeyDown={onKeyDown}
          inputRef={inputRef}
          busy={busy}
          autoFocus
          size="large"
        />
      </form>

      <div className="mt-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Suggestions</p>
        <div className="flex flex-col gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPickSuggestion(s)}
              className="group flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <span>{s}</span>
              <span className="text-xs text-slate-300 transition group-hover:text-indigo-500">↵</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function InputBar({
  input,
  setInput,
  onKeyDown,
  inputRef,
  busy,
  autoFocus,
  size = 'default',
}: {
  input: string
  setInput: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  inputRef: React.RefObject<HTMLTextAreaElement>
  busy: boolean
  autoFocus?: boolean
  size?: 'default' | 'large'
}) {
  const isLarge = size === 'large'
  return (
    <div
      className={`flex items-end gap-2 rounded-2xl border border-slate-200 bg-white transition focus-within:border-indigo-400 focus-within:shadow-[0_0_0_4px_rgba(99,102,241,0.12)] ${
        isLarge ? 'px-4 py-3' : 'px-3 py-2'
      }`}
    >
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Demande à Iris…"
        rows={1}
        autoFocus={autoFocus}
        className={`max-h-32 w-full resize-none bg-transparent text-slate-800 outline-none placeholder:text-slate-400 ${
          isLarge ? 'text-base' : 'text-sm'
        }`}
        disabled={busy}
      />
      <button
        type="submit"
        disabled={busy || !input.trim()}
        aria-label="Envoyer"
        className={`flex shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 ${
          isLarge ? 'h-9 w-9' : 'h-7 w-7'
        }`}
      >
        <ArrowUp className={isLarge ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      </button>
    </div>
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
                className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600"
              >
                🔧 {tc.name}
              </span>
            ))}
          </div>
        )}
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
            isUser
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-800'
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  )
}
