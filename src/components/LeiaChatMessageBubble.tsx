'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowRight,
  Calendar,
  Check,
  Copy,
  Inbox,
  Mail,
  Package2,
  Wrench,
} from 'lucide-react'

export type LeiaToolCall = {
  name: string
  args: unknown
  result: unknown
}

export type LeiaChatRenderableMessage = {
  role: 'user' | 'assistant'
  content: string
  reasoningSummary?: string
  tool_calls?: LeiaToolCall[]
}

type CalendarEventCreated = {
  ok: true
  event: { id?: string; title: string; start: string; end: string; kind: string }
  advisor_triggered?: boolean
}

type PendingCalendarConfirmation = {
  ok: true
  pending_confirmation: true
  message?: string
  event: { title: string; start: string; end: string; kind: string }
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

function extractCalendarCreation(toolCalls: LeiaToolCall[] | undefined): CalendarEventCreated | null {
  if (!toolCalls) return null

  for (const toolCall of toolCalls) {
    if (toolCall.name !== 'create_calendar_event') continue
    const result = toolCall.result as CalendarEventCreated | PendingCalendarConfirmation | { ok: false }

    if (
      result &&
      typeof result === 'object' &&
      'ok' in result &&
      result.ok &&
      !('pending_confirmation' in result)
    ) {
      return result as CalendarEventCreated
    }
  }

  return null
}

function extractPendingCalendarConfirmation(
  toolCalls: LeiaToolCall[] | undefined
): PendingCalendarConfirmation | null {
  if (!toolCalls) return null

  for (const toolCall of toolCalls) {
    if (toolCall.name !== 'create_calendar_event') continue
    const result = toolCall.result as PendingCalendarConfirmation | { ok: false }

    if (
      result &&
      typeof result === 'object' &&
      'ok' in result &&
      result.ok &&
      'pending_confirmation' in result &&
      result.pending_confirmation
    ) {
      return result as PendingCalendarConfirmation
    }
  }

  return null
}

function extractRestockPlan(toolCalls: LeiaToolCall[] | undefined): RestockPlanCreated | null {
  if (!toolCalls) return null

  for (const toolCall of toolCalls) {
    if (toolCall.name !== 'propose_restock_plan') continue
    const result = toolCall.result as RestockPlanCreated | { ok: false }

    if (result && typeof result === 'object' && 'ok' in result && result.ok) {
      return result as RestockPlanCreated
    }
  }

  return null
}

function extractEmailDrafts(toolCalls: LeiaToolCall[] | undefined): EmailDraft[] {
  if (!toolCalls) return []

  for (const toolCall of toolCalls) {
    if (toolCall.name !== 'draft_supplier_emails') continue
    const result = toolCall.result as { ok: true; drafts: EmailDraft[] } | { ok: false }

    if (result && typeof result === 'object' && 'ok' in result && result.ok && 'drafts' in result) {
      return result.drafts
    }
  }

  return []
}

export function LeiaChatMessageBubble({
  message,
  onNavigate,
}: {
  message: LeiaChatRenderableMessage
  onNavigate?: () => void
}) {
  const isUser = message.role === 'user'
  const calendarCreated = !isUser ? extractCalendarCreation(message.tool_calls) : null
  const calendarPending = !isUser ? extractPendingCalendarConfirmation(message.tool_calls) : null
  const restockPlan = !isUser ? extractRestockPlan(message.tool_calls) : null
  const emailDrafts = !isUser ? extractEmailDrafts(message.tool_calls) : []

  return (
    <div className={`iris-msg ${isUser ? 'iris-msg--user' : 'iris-msg--assistant'}`}>
      {message.tool_calls && message.tool_calls.length > 0 ? (
        <div className="iris-msg__tools">
          {message.tool_calls.map((toolCall, index) => (
            <span key={`${toolCall.name}-${index}`} className="iris-msg__tool-chip">
              <Wrench className="h-3 w-3" />
              <span>{toolCall.name}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="iris-msg__bubble">
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="iris-md__p">{children}</p>,
              strong: ({ children }) => <strong className="iris-md__strong">{children}</strong>,
              em: ({ children }) => <em className="iris-md__em">{children}</em>,
              ul: ({ children }) => <ul className="iris-md__list">{children}</ul>,
              ol: ({ children }) => <ol className="iris-md__list iris-md__list--ordered">{children}</ol>,
              li: ({ children }) => <li className="iris-md__li">{children}</li>,
              hr: () => <hr className="iris-md__hr" />,
              code: ({ children }) => <code className="iris-md__code">{children}</code>,
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

      {!isUser && message.reasoningSummary ? (
        <p className="rounded border border-[#DDE5EE] bg-[#F2F8FF] px-3 py-2 font-serif text-[12px] text-[#30373E]">
          {message.reasoningSummary}
        </p>
      ) : null}

      {calendarPending ? <PendingCalendarCard pending={calendarPending} /> : null}
      {calendarCreated ? <EventRecapCard event={calendarCreated} onNavigate={onNavigate} /> : null}
      {restockPlan && restockPlan.created ? (
        <RestockPlanCard plan={restockPlan} onNavigate={onNavigate} />
      ) : null}
      {emailDrafts.length > 0 ? (
        <div className="iris-drafts">
          {emailDrafts.map((draft, index) => (
            <EmailDraftCard key={`${draft.supplier}-${index}`} draft={draft} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function PendingCalendarCard({ pending }: { pending: PendingCalendarConfirmation }) {
  return (
    <div className="iris-recap">
      <div className="iris-recap__header">
        <div className="iris-recap__badge">
          <Calendar className="h-4 w-4" />
        </div>
        <div className="iris-recap__titles">
          <p className="iris-recap__title">{pending.event.title}</p>
          <p className="iris-recap__dates">
            {pending.event.start} {'->'} {pending.event.end}
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-[#DDE5EE] bg-[#F2F8FF] px-3 py-2 font-serif text-[12px] text-[#30373E]">
        Reply with a clear &quot;yes&quot; or &quot;oui&quot; to add this leave to the calendar.
      </div>
    </div>
  )
}

function EventRecapCard({
  event,
  onNavigate,
}: {
  event: CalendarEventCreated
  onNavigate?: () => void
}) {
  const router = useRouter()
  const isLeave = event.event.kind === 'leave'

  const go = (href: string) => {
    router.push(href)
    onNavigate?.()
  }

  return (
    <div className="iris-recap">
      <div className="iris-recap__header">
        <div className="iris-recap__badge">
          <Calendar className="h-4 w-4" />
        </div>
        <div className="iris-recap__titles">
          <p className="iris-recap__title">{event.event.title}</p>
          <p className="iris-recap__dates">
            {event.event.start} {'->'} {event.event.end}
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
          <span>Open calendar</span>
          <ArrowRight className="h-3 w-3 opacity-60" />
        </button>
        {isLeave && event.advisor_triggered ? (
          <button
            type="button"
            onClick={() => go('/actions')}
            className="iris-recap__btn iris-recap__btn--primary"
          >
            <Inbox className="h-3.5 w-3.5" />
            <span>Open actions</span>
            <ArrowRight className="h-3 w-3 opacity-80" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function RestockPlanCard({
  plan,
  onNavigate,
}: {
  plan: RestockPlanCreated
  onNavigate?: () => void
}) {
  const router = useRouter()

  return (
    <div className="iris-recap">
      <div className="iris-recap__header">
        <div className="iris-recap__badge">
          <Package2 className="h-4 w-4" />
        </div>
        <div className="iris-recap__titles">
          <p className="iris-recap__title">
            Restock plan - {plan.items_count} SKU{(plan.items_count ?? 0) > 1 ? 's' : ''}
          </p>
          <p className="iris-recap__dates">
            {(plan.total_estimated_cost_eur ?? 0).toFixed(0)} EUR · {plan.horizon_days}-day horizon
          </p>
        </div>
      </div>
      <div className="iris-recap__actions">
        <button
          type="button"
          onClick={() => {
            router.push('/actions')
            onNavigate?.()
          }}
          className="iris-recap__btn iris-recap__btn--primary"
        >
          <Inbox className="h-3.5 w-3.5" />
          <span>Open actions</span>
          <ArrowRight className="h-3 w-3 opacity-80" />
        </button>
      </div>
    </div>
  )
}

function EmailDraftCard({ draft }: { draft: EmailDraft }) {
  const [copied, setCopied] = useState(false)
  const fullText = `${draft.subject}\n\n${draft.body}`
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // noop
    }
  }

  return (
    <div className="iris-email">
      <div className="iris-email__header">
        <div className="iris-email__icon">
          <Mail className="h-3.5 w-3.5" />
        </div>
        <div className="iris-email__meta">
          <p className="iris-email__supplier">{draft.supplier}</p>
          <p className="iris-email__stats">
            {draft.items_count} SKU · {draft.total_units} units · {draft.total_cost_eur.toFixed(0)} EUR
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
          <span>Open Gmail</span>
          <ArrowRight className="h-3 w-3 opacity-80" />
        </a>
      </div>
    </div>
  )
}
