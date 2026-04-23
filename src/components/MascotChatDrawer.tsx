'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowUp,
  Calendar,
  Inbox,
  ArrowRight,
  Trash2,
  Copy,
  Check,
  Mail,
  Mic,
  Square,
  Loader2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAudioRecorder } from './useAudioRecorder'

const STORAGE_KEY = 'iris_chat_history_v1'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  tool_calls?: Array<{ name: string; args: unknown; result: unknown }>
}

const PLACEHOLDER_PROMPTS = [
  "How much total stock do I have?",
  "I'm on leave from May 5th to May 15th",
  "What actions are pending?",
  "Stock of the Oslo chair?",
  "Find my out-of-stock tables",
  "List products I need to reorder",
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
  const [hydrated, setHydrated] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const placeholderActive = open && input.length === 0 && messages.length === 0 && !busy
  const animatedPlaceholder = useTypingPlaceholder(placeholderActive, PLACEHOLDER_PROMPTS)

  // Hydrate depuis sessionStorage au mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[]
        if (Array.isArray(parsed)) setMessages(parsed)
      }
    } catch {
      /* noop */
    }
    setHydrated(true)
  }, [])

  // Persiste dans sessionStorage quand messages change
  useEffect(() => {
    if (!hydrated) return
    try {
      if (messages.length === 0) {
        sessionStorage.removeItem(STORAGE_KEY)
      } else {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
      }
    } catch {
      /* noop */
    }
  }, [messages, hydrated])

  // Focus input on open, clear input and error on close
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
    setInput('')
    setError(null)
  }, [open])

  const clearHistory = () => {
    setMessages([])
    setInput('')
    setError(null)
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* noop */
    }
  }

  const recorder = useAudioRecorder()
  const [transcribing, setTranscribing] = useState(false)

  const handleMicClick = async () => {
    if (transcribing || busy) return
    if (recorder.state === 'recording') {
      const blob = await recorder.stop()
      if (!blob) return
      setTranscribing(true)
      setError(null)
      try {
        const form = new FormData()
        const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
        form.append('file', blob, `iris-${Date.now()}.${ext}`)
        form.append('language', 'en')
        const resp = await fetch('/api/mascot/transcribe', {
          method: 'POST',
          body: form,
        })
        const data = await resp.json()
        if (!resp.ok) throw new Error(data?.error ?? 'Transcription failed')
        const text = String(data?.text ?? '').trim()
        if (text) {
          setInput((prev) => (prev ? `${prev} ${text}` : text))
          setTimeout(() => inputRef.current?.focus(), 40)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transcription error')
      } finally {
        setTranscribing(false)
      }
    } else if (recorder.state === 'idle') {
      await recorder.start()
    }
  }

  const formatDuration = (ms: number) => {
    const total = Math.floor(ms / 1000)
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const isRecording = recorder.state === 'recording'
  const isStarting = recorder.state === 'requesting'

  // Auto-resize du textarea en fonction du contenu
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [input])

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
        throw new Error(data?.error ?? 'Request failed')
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
      setError(err instanceof Error ? err.message : 'Unknown error')
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
        aria-label="Mira"
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
            placeholder={
              isRecording
                ? `Recording… ${formatDuration(recorder.durationMs)}`
                : transcribing
                  ? 'Transcribing…'
                  : placeholderActive
                    ? animatedPlaceholder || '\u00a0'
                    : 'Mira'
            }
            rows={1}
            className="iris-searchbar__input"
            disabled={busy || isRecording || transcribing}
          />
          {recorder.isSupported && !input.trim() && !isRecording && !transcribing && hasConversation && (
            <button
              type="button"
              onClick={clearHistory}
              aria-label="Clear history"
              title="Clear history"
              className="iris-searchbar__clear"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {recorder.isSupported && !input.trim() && !busy && (
            <button
              type="button"
              onClick={handleMicClick}
              disabled={transcribing || isStarting}
              aria-label={isRecording ? "Stop recording" : 'Talk to Mira'}
              title={isRecording ? "Stop recording" : 'Talk to Mira'}
              className={`iris-searchbar__mic ${
                isRecording ? 'iris-searchbar__mic--recording' : ''
              } ${transcribing ? 'iris-searchbar__mic--transcribing' : ''}`}
            >
              {transcribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isRecording ? (
                <Square className="h-3.5 w-3.5 fill-current" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          )}
          {input.trim() && (
            <button
              type="submit"
              aria-label="Send"
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
              <MessageBubble key={idx} message={m} onNavigate={onClose} />
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

type CalendarEventCreated = {
  ok: true
  event: { id: string; title: string; start: string; end: string; kind: string }
  advisor_triggered?: boolean
}

type RestockPlanCreated = {
  ok: true
  created: boolean
  recommendation_id?: string
  horizon_days: number
  items_count?: number
  total_estimated_cost_eur?: number
  message?: string
}

type EmailDraft = {
  supplier: string
  subject: string
  body: string
  items_count: number
  total_units: number
  total_cost_eur: number
  order_deadline: string | null
}

function extractCalendarCreation(
  toolCalls: ChatMessage['tool_calls']
): CalendarEventCreated | null {
  if (!toolCalls) return null
  for (const tc of toolCalls) {
    if (tc.name !== 'create_calendar_event') continue
    const r = tc.result as CalendarEventCreated | { ok: false }
    if (r && typeof r === 'object' && 'ok' in r && r.ok) {
      return r as CalendarEventCreated
    }
  }
  return null
}

function extractRestockPlan(
  toolCalls: ChatMessage['tool_calls']
): RestockPlanCreated | null {
  if (!toolCalls) return null
  for (const tc of toolCalls) {
    if (tc.name !== 'propose_restock_plan') continue
    const r = tc.result as RestockPlanCreated | { ok: false }
    if (r && typeof r === 'object' && 'ok' in r && r.ok) {
      return r as RestockPlanCreated
    }
  }
  return null
}

function extractEmailDrafts(
  toolCalls: ChatMessage['tool_calls']
): EmailDraft[] {
  if (!toolCalls) return []
  for (const tc of toolCalls) {
    if (tc.name !== 'draft_supplier_emails') continue
    const r = tc.result as { ok: true; drafts: EmailDraft[] } | { ok: false }
    if (r && typeof r === 'object' && 'ok' in r && r.ok && 'drafts' in r) {
      return r.drafts
    }
  }
  return []
}

function MessageBubble({
  message,
  onNavigate,
}: {
  message: ChatMessage
  onNavigate: () => void
}) {
  const isUser = message.role === 'user'
  const calendarCreated = !isUser ? extractCalendarCreation(message.tool_calls) : null
  const restockPlan = !isUser ? extractRestockPlan(message.tool_calls) : null
  const emailDrafts = !isUser ? extractEmailDrafts(message.tool_calls) : []

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
      <div className="iris-msg__bubble">
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="iris-md__p">{children}</p>,
              strong: ({ children }) => (
                <strong className="iris-md__strong">{children}</strong>
              ),
              em: ({ children }) => <em className="iris-md__em">{children}</em>,
              ul: ({ children }) => <ul className="iris-md__list">{children}</ul>,
              ol: ({ children }) => <ol className="iris-md__list iris-md__list--ordered">{children}</ol>,
              li: ({ children }) => <li className="iris-md__li">{children}</li>,
              hr: () => <hr className="iris-md__hr" />,
              code: ({ children }) => (
                <code className="iris-md__code">{children}</code>
              ),
              a: ({ children, href }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="iris-md__link"
                >
                  {children}
                </a>
              ),
            }}
          >
            {message.content}
          </ReactMarkdown>
        )}
      </div>
      {calendarCreated && (
        <EventRecapCard event={calendarCreated} onNavigate={onNavigate} />
      )}
      {restockPlan && restockPlan.created && (
        <RestockPlanCard plan={restockPlan} onNavigate={onNavigate} />
      )}
      {emailDrafts.length > 0 && (
        <div className="iris-drafts">
          {emailDrafts.map((d, i) => (
            <EmailDraftCard key={i} draft={d} />
          ))}
        </div>
      )}
    </div>
  )
}

function EventRecapCard({
  event,
  onNavigate,
}: {
  event: CalendarEventCreated
  onNavigate: () => void
}) {
  const router = useRouter()
  const isLeave = event.event.kind === 'leave'

  const go = (href: string) => {
    router.push(href)
    onNavigate()
  }

  return (
    <div className="iris-recap">
      <div className="iris-recap__header">
        <div className="iris-recap__badge">
          {isLeave ? '🏖️' : '📅'}
        </div>
        <div className="iris-recap__titles">
          <p className="iris-recap__title">{event.event.title}</p>
          <p className="iris-recap__dates">
            {event.event.start} → {event.event.end}
          </p>
        </div>
      </div>
      <div className="iris-recap__actions">
        <button
          type="button"
          onClick={() => go('/calendar')}
          className="iris-recap__btn iris-recap__btn--secondary"
        >
          <Calendar className="h-3.5 w-3.5" />
          <span>View in calendar</span>
          <ArrowRight className="h-3 w-3 opacity-60" />
        </button>
        {isLeave && event.advisor_triggered && (
          <button
            type="button"
            onClick={() => go('/actions')}
            className="iris-recap__btn iris-recap__btn--primary"
          >
            <Inbox className="h-3.5 w-3.5" />
            <span>View restock plan</span>
            <ArrowRight className="h-3 w-3 opacity-80" />
          </button>
        )}
      </div>
    </div>
  )
}

function RestockPlanCard({
  plan,
  onNavigate,
}: {
  plan: RestockPlanCreated
  onNavigate: () => void
}) {
  const router = useRouter()
  return (
    <div className="iris-recap">
      <div className="iris-recap__header">
        <div className="iris-recap__badge">📦</div>
        <div className="iris-recap__titles">
          <p className="iris-recap__title">
            Restock plan — {plan.items_count} SKU{(plan.items_count ?? 0) > 1 ? 's' : ''}
          </p>
          <p className="iris-recap__dates">
            {(plan.total_estimated_cost_eur ?? 0).toFixed(0)} € · {plan.horizon_days}-day horizon
          </p>
        </div>
      </div>
      <div className="iris-recap__actions">
        <button
          type="button"
          onClick={() => {
            router.push('/actions')
            onNavigate()
          }}
          className="iris-recap__btn iris-recap__btn--primary"
        >
          <Inbox className="h-3.5 w-3.5" />
          <span>Open in inbox</span>
          <ArrowRight className="h-3 w-3 opacity-80" />
        </button>
      </div>
    </div>
  )
}

function EmailDraftCard({ draft }: { draft: EmailDraft }) {
  const [copied, setCopied] = useState(false)

  const fullText = `${draft.subject}\n\n${draft.body}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* noop */
    }
  }

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`

  return (
    <div className="iris-email">
      <div className="iris-email__header">
        <div className="iris-email__icon">
          <Mail className="h-3.5 w-3.5" />
        </div>
        <div className="iris-email__meta">
          <p className="iris-email__supplier">{draft.supplier}</p>
          <p className="iris-email__stats">
            {draft.items_count} SKU · {draft.total_units} units · {draft.total_cost_eur.toFixed(0)} €
          </p>
        </div>
      </div>
      <div className="iris-email__subject">{draft.subject}</div>
      <pre className="iris-email__body">{draft.body}</pre>
      <div className="iris-email__actions">
        <button
          type="button"
          onClick={handleCopy}
          className={`iris-email__btn ${copied ? 'iris-email__btn--success' : ''}`}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
        <a
          href={gmailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="iris-email__btn iris-email__btn--primary"
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Open in Gmail</span>
          <ArrowRight className="h-3 w-3 opacity-80" />
        </a>
      </div>
    </div>
  )
}
