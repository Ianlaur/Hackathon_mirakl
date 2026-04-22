'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  tool_calls?: Array<{ name: string; args: unknown; result: unknown }>
}

const PLACEHOLDER_PROMPTS = [
  "Combien j'ai de stock au total ?",
  'Je pars en vacances du 5 au 15 mai',
  "Quelles actions m'attendent ?",
  'Stock de la chaise Oslo ?',
  'Cherche mes tables en rupture',
  'Liste mes produits à commander',
]

const TYPE_SPEED_MS = 38
const ERASE_SPEED_MS = 22
const HOLD_FULL_MS = 1800
const HOLD_EMPTY_MS = 400

function useTypingPlaceholder(active: boolean, prompts: string[]): string {
  const [text, setText] = useState('')

  useEffect(() => {
    if (!active) {
      setText('')
      return
    }
    let cancelled = false
    let promptIdx = 0
    let charIdx = 0
    let mode: 'typing' | 'holding' | 'erasing' | 'hold-empty' = 'typing'
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const tick = () => {
      if (cancelled) return
      const current = prompts[promptIdx]

      if (mode === 'typing') {
        charIdx++
        setText(current.slice(0, charIdx))
        if (charIdx >= current.length) {
          mode = 'holding'
          timeoutId = setTimeout(tick, HOLD_FULL_MS)
        } else {
          timeoutId = setTimeout(tick, TYPE_SPEED_MS + Math.random() * 40)
        }
      } else if (mode === 'holding') {
        mode = 'erasing'
        timeoutId = setTimeout(tick, ERASE_SPEED_MS)
      } else if (mode === 'erasing') {
        charIdx--
        setText(current.slice(0, charIdx))
        if (charIdx <= 0) {
          mode = 'hold-empty'
          timeoutId = setTimeout(tick, HOLD_EMPTY_MS)
        } else {
          timeoutId = setTimeout(tick, ERASE_SPEED_MS)
        }
      } else {
        promptIdx = (promptIdx + 1) % prompts.length
        charIdx = 0
        mode = 'typing'
        timeoutId = setTimeout(tick, TYPE_SPEED_MS)
      }
    }

    timeoutId = setTimeout(tick, 400)

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [active, prompts])

  return text
}

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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const placeholderActive = open && input.length === 0 && messages.length === 0 && !busy
  const animatedPlaceholder = useTypingPlaceholder(placeholderActive, PLACEHOLDER_PROMPTS)

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
    setMessages([])
    setInput('')
    setError(null)
  }, [open])

  useEffect(() => {
    if (messages.length > 0) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
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

  const hasConversation = messages.length > 0

  return (
    <div
      className={`iris-overlay ${open ? 'iris-overlay--open' : 'iris-overlay--closed'}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      aria-hidden={!open}
    >
      <div
        className={`iris-panel ${open ? 'iris-panel--open' : 'iris-panel--closed'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Iris"
      >
        <form onSubmit={handleSubmit} className="iris-searchbar">
          <div className="iris-searchbar__glyph">
            <span className="iris-searchbar__dot iris-searchbar__dot--pink" />
            <span className="iris-searchbar__dot iris-searchbar__dot--blue" />
            <span className="iris-searchbar__dot iris-searchbar__dot--violet" />
          </div>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholderActive ? animatedPlaceholder || '\u00a0' : 'Iris'}
            rows={1}
            className="iris-searchbar__input"
            disabled={busy}
          />
          {input.trim() && (
            <button
              type="submit"
              aria-label="Envoyer"
              disabled={busy}
              className="iris-searchbar__submit"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </form>

        {(hasConversation || busy || error) && (
          <div ref={scrollRef} className="iris-conversation">
            {messages.map((m, idx) => (
              <MessageBubble key={idx} message={m} />
            ))}
            {busy && (
              <div className="iris-conversation__thinking">
                <span className="iris-conversation__thinking-dot" />
                <span className="iris-conversation__thinking-dot" />
                <span className="iris-conversation__thinking-dot" />
              </div>
            )}
            {error && <div className="iris-conversation__error">{error}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`iris-msg ${isUser ? 'iris-msg--user' : 'iris-msg--assistant'}`}>
      {message.tool_calls && message.tool_calls.length > 0 && (
        <div className="iris-msg__tools">
          {message.tool_calls.map((tc, i) => (
            <span
              key={i}
              title={JSON.stringify(tc.args)}
              className="iris-msg__tool-chip"
            >
              🔧 {tc.name}
            </span>
          ))}
        </div>
      )}
      <div className="iris-msg__bubble">{message.content}</div>
    </div>
  )
}
