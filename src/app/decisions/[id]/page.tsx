import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowLeft, Clock, RotateCcw, ShieldCheck } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

type DecisionPayload = Record<string, unknown>

function humanize(value: string | null | undefined) {
  return String(value || 'unknown')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value: Date | null | undefined) {
  if (!value) return 'Not yet'
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function payloadText(payload: unknown, keys: string[], fallback: string) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback
  const record = payload as DecisionPayload

  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }

  return fallback
}

export default async function DecisionDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const userId = await getCurrentUserId()
  const decision = await prisma.decisionLedger.findFirst({
    where: {
      id: params.id,
      user_id: userId,
    },
  })

  if (!decision) notFound()

  const history = decision.sku
    ? await prisma.decisionLedger.findMany({
        where: {
          user_id: userId,
          sku: decision.sku,
          NOT: { id: decision.id },
        },
        orderBy: { created_at: 'desc' },
        take: 5,
      })
    : []

  const ifNothing = payloadText(
    decision.raw_payload,
    ['if_nothing_is_done', 'if_nothing', 'risk', 'reason'],
    'Leia has not attached a separate downside note yet. Use the reasoning trace above for the current operational risk.'
  )
  const howToUndo = payloadText(
    decision.raw_payload,
    ['how_to_undo', 'undo', 'rollback'],
    decision.reversible
      ? 'This action is marked reversible. Restore the previous channel, stock, or autonomy setting from the relevant operational screen.'
      : 'This decision is not marked reversible. Create an override and record the reason before changing the operational state.'
  )

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F2F8FF]/35 p-4 sm:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-2 rounded border border-[#BFCBDA] bg-white px-3 py-2 font-serif text-[13px] font-bold text-[#30373E] transition-colors hover:bg-[#F2F8FF]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <section className="rounded-lg border border-[#DDE5EE] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
          <div className="border-b border-[#DDE5EE] px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-serif text-[11px] font-bold uppercase tracking-[0.1em] text-[#6B7480]">
                  Leia decision
                </p>
                <h1 className="mt-1 font-serif text-[24px] font-bold leading-tight text-[#03182F]">
                  {humanize(decision.action_type)}
                  {decision.sku ? ` for ${decision.sku}` : ''}
                </h1>
              </div>
              <span className="rounded-full border border-[#2764FF]/20 bg-[#2764FF]/10 px-3 py-1.5 font-serif text-[12px] font-bold text-[#2764FF]">
                {humanize(decision.status)}
              </span>
            </div>
          </div>

          <div className="grid gap-px bg-[#DDE5EE] md:grid-cols-4">
            {[
              ['SKU', decision.sku || 'No SKU'],
              ['Channel', decision.channel || 'Global'],
              ['Agent', decision.source_agent || 'Leia'],
              ['Created', formatDate(decision.created_at)],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-5 py-4">
                <div className="font-serif text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7480]">
                  {label}
                </div>
                <div className="mt-1 font-serif text-[15px] font-bold text-[#03182F]">{value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-5">
              <section>
                <div className="mb-2 flex items-center gap-2 font-serif text-[13px] font-bold uppercase tracking-[0.08em] text-[#03182F]">
                  <ShieldCheck className="h-4 w-4 text-[#2764FF]" />
                  Reasoning
                </div>
                <p className="rounded-lg border border-[#DDE5EE] bg-[#F7FAFD] p-4 font-serif text-[14px] leading-6 text-[#30373E]">
                  {decision.logical_inference}
                </p>
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2 font-serif text-[13px] font-bold uppercase tracking-[0.08em] text-[#03182F]">
                  <AlertTriangle className="h-4 w-4 text-[#F22E75]" />
                  If nothing is done
                </div>
                <p className="rounded-lg border border-[#F22E75]/20 bg-[#FFE7EC] p-4 font-serif text-[14px] leading-6 text-[#7F1239]">
                  {ifNothing}
                </p>
              </section>

              <section>
                <div className="mb-2 flex items-center gap-2 font-serif text-[13px] font-bold uppercase tracking-[0.08em] text-[#03182F]">
                  <RotateCcw className="h-4 w-4 text-[#3FA46A]" />
                  How to undo
                </div>
                <p className="rounded-lg border border-[#3FA46A]/20 bg-[#3FA46A]/10 p-4 font-serif text-[14px] leading-6 text-[#1E5A3A]">
                  {howToUndo}
                </p>
              </section>
            </div>

            <aside className="rounded-lg border border-[#DDE5EE] bg-[#F7FAFD] p-4">
              <div className="mb-3 flex items-center gap-2 font-serif text-[13px] font-bold uppercase tracking-[0.08em] text-[#03182F]">
                <Clock className="h-4 w-4 text-[#2764FF]" />
                Same SKU history
              </div>
              {history.length > 0 ? (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="rounded border border-[#DDE5EE] bg-white p-3">
                      <div className="font-serif text-[13px] font-bold text-[#03182F]">
                        {humanize(item.action_type)}
                      </div>
                      <div className="mt-1 font-serif text-[12px] text-[#6B7480]">
                        {humanize(item.status)} · {formatDate(item.created_at)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="font-serif text-[13px] leading-5 text-[#6B7480]">
                  No earlier Leia decisions on this SKU.
                </p>
              )}
            </aside>
          </div>
        </section>
      </div>
    </div>
  )
}
