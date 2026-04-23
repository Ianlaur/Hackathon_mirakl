'use client'

import { useMemo, useState } from 'react'
import type { PlanItemDTO, RecommendationDTO } from './types'

const priorityStyles: Record<PlanItemDTO['priority'], string> = {
  critical: 'bg-[#FFE7EC] text-[#F22E75]',
  high: 'bg-[#E0A93A]/10 text-amber-700',
  medium: 'bg-[#E9F0FF] text-[#2764FF]',
}

export function RecommendationDetailPanel({
  recommendation,
  onStatusChange,
}: {
  recommendation: RecommendationDTO
  onStatusChange: (next: RecommendationDTO) => void
}) {
  // MIRA decision_ledger rows carry evidence but no action_payload.
  // Route to the simplified panel so they render correctly.
  if (!recommendation.action_payload) {
    return <MiraDecisionPanel recommendation={recommendation} onStatusChange={onStatusChange} />
  }
  return <RichCopilotPanel recommendation={recommendation} onStatusChange={onStatusChange} />
}

function MiraDecisionPanel({
  recommendation,
  onStatusChange,
}: {
  recommendation: RecommendationDTO
  onStatusChange: (next: RecommendationDTO) => void
}) {
  const isPending = recommendation.status === 'pending_approval'
  const isExecuted = recommendation.status === 'approved' // auto_executed collapses into approved via the adapter
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const evidence = recommendation.evidence_payload ?? []
  const scenario = recommendation.scenario_type

  const submit = async (action: 'approve' | 'reject' | 'override') => {
    if (action === 'override' && !reason.trim()) {
      setError('Une raison est requise pour annuler.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { action }
      if (reason.trim()) body.reason = reason.trim()

      const response = await fetch(`/api/mira/decisions/${recommendation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error ?? 'Request failed')

      // Map the returned decision status back through the same rules as the adapter.
      const backendStatus = (data?.decision?.status ?? '') as string
      const uiStatus =
        backendStatus === 'proposed' || backendStatus === 'queued'
          ? 'pending_approval'
          : backendStatus === 'auto_executed' || backendStatus === 'approved'
            ? 'approved'
            : backendStatus === 'overridden' || backendStatus === 'rejected'
              ? 'rejected'
              : recommendation.status

      onStatusChange({ ...recommendation, status: uiStatus })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 pb-4">
        <p className="text-[10px] uppercase tracking-[0.1em] text-[#6B7480]">{scenario.replace(/_/g, ' ')}</p>
        <h2 className="mt-1 font-serif text-xl font-semibold text-[#03182F]">{recommendation.title}</h2>
        {recommendation.reasoning_summary ? (
          <p className="mt-3 whitespace-pre-wrap font-serif text-sm text-[#30373E]">
            {recommendation.reasoning_summary}
          </p>
        ) : null}
      </header>

      {evidence.length > 0 ? (
        <section className="mt-5">
          <p className="font-serif text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7480]">
            Preuves
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            {evidence.map((e, i) => (
              <div key={`${e.label}-${i}`} className="rounded border border-[#DDE5EE] bg-[#F2F8FF] px-3 py-2">
                <dt className="text-[10px] font-bold uppercase tracking-wide text-[#6B7480]">{e.label}</dt>
                <dd className="mt-0.5 font-mono text-sm text-[#03182F]">{e.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <div className="mt-auto border-t border-slate-200 pt-4">
        {error ? <p className="mb-3 font-serif text-sm text-[#F22E75]">{error}</p> : null}
        {(isPending || isExecuted) && (
          <div className="space-y-3">
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isExecuted ? 'Raison (obligatoire pour annuler)' : 'Raison (facultative)'}
              className="w-full rounded border border-[#DDE5EE] bg-white px-3 py-2 font-serif text-sm text-[#03182F] outline-none focus:border-[#2764FF]"
            />
            <div className="flex items-center justify-end gap-2">
              {isPending ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => submit('reject')}
                    className="rounded border border-[#BFCBDA] bg-white px-4 py-2 font-serif text-sm font-medium text-[#30373E] hover:bg-slate-50 disabled:opacity-50"
                  >
                    Rejeter
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => submit('approve')}
                    className="rounded bg-[#2764FF] px-4 py-2 font-serif text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Approuver
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => submit('override')}
                  className="rounded bg-[#F22E75] px-4 py-2 font-serif text-sm font-semibold text-white hover:bg-[#d62766] disabled:opacity-50"
                >
                  Annuler la décision
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RichCopilotPanel({
  recommendation,
  onStatusChange,
}: {
  recommendation: RecommendationDTO
  onStatusChange: (next: RecommendationDTO) => void
}) {
  const payload = recommendation.action_payload!
  const isPending = recommendation.status === 'pending_approval'
  const items = payload.items ?? []

  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(items.map((item) => item.product_id))
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedItems = useMemo(
    () => items.filter((item) => checked.has(item.product_id)),
    [items, checked]
  )
  const selectedCost = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.estimated_cost_eur, 0),
    [selectedItems]
  )

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = async (action: 'approve' | 'reject') => {
    setBusy(true)
    setError(null)
    try {
      const body =
        action === 'approve'
          ? {
              comment: `Approved on ${selectedItems.length}/${items.length} lines, ${selectedCost.toFixed(2)} EUR`,
              selected_product_ids: Array.from(checked),
            }
          : {}

      const response = await fetch(
        `/api/copilot/recommendations/${recommendation.id}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Request failed')
      }

      const data = await response.json()
      onStatusChange({ ...recommendation, status: data.recommendation.status })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#6B7480]">
              Leave detected
              {payload.leave_duration_days
                ? ` | ${payload.leave_duration_days} days`
                : ''}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#03182F]">
              {recommendation.title}
            </h2>
          </div>
          {payload.order_deadline && (
            <div className="rounded-md bg-[#FFE7EC] px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#F22E75]">
                Order deadline
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[#03182F]">
                {payload.order_deadline}
              </p>
            </div>
          )}
        </div>
        <p className="mt-3 text-sm text-[#30373E]">
          {recommendation.reasoning_summary}
        </p>
        {recommendation.expected_impact && (
          <p className="mt-2 text-xs text-[#3FA46A]">
            {recommendation.expected_impact}
          </p>
        )}
      </header>

      {(payload.supplementary_notes?.length ?? 0) > 0 && (
        <div className="mt-4 space-y-1 rounded-md bg-[#E0A93A]/10 p-3">
          {(payload.supplementary_notes ?? []).map((note, index) => (
            <p key={index} className="text-xs text-[#30373E]">
              {note}
            </p>
          ))}
        </div>
      )}

      <div className="mt-6 flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-[#6B7480]">
            <tr>
              <th className="p-3 text-left">Select</th>
              <th className="p-3 text-left">Priority</th>
              <th className="p-3 text-left">SKU</th>
              <th className="p-3 text-left">Product</th>
              <th className="p-3 text-right">Stock</th>
              <th className="p-3 text-right">Projection</th>
              <th className="p-3 text-right">Rec. qty</th>
              <th className="p-3 text-left">Supplier</th>
              <th className="p-3 text-right">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.product_id} className="hover:bg-slate-50">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={checked.has(item.product_id)}
                    onChange={() => toggle(item.product_id)}
                    disabled={!isPending}
                  />
                </td>
                <td className="p-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityStyles[item.priority]}`}
                  >
                    {item.priority}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs text-[#30373E]">
                  {item.sku ?? '-'}
                </td>
                <td className="p-3 text-[#03182F]">{item.product_name}</td>
                <td className="p-3 text-right tabular-nums">
                  {item.current_stock}
                </td>
                <td
                  className={`p-3 text-right tabular-nums ${
                    item.projected_stock_end_of_leave < 0
                      ? 'font-medium text-[#F22E75]'
                      : 'text-[#30373E]'
                  }`}
                >
                  {item.projected_stock_end_of_leave}
                </td>
                <td className="p-3 text-right tabular-nums font-semibold text-[#03182F]">
                  +{item.recommended_qty}
                </td>
                <td className="p-3 text-xs text-[#30373E]">
                  {item.supplier ?? '-'}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {typeof item.estimated_cost_eur === 'number'
                    ? `${item.estimated_cost_eur.toFixed(2)} EUR`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isPending && (
        <footer className="mt-6 border-t border-slate-200 pt-4">
          {error && <p className="mb-3 text-sm text-[#F22E75]">{error}</p>}
          <div className="flex items-center justify-between">
            <div className="text-sm text-[#6B7480]">
              {selectedItems.length}/{items.length} lines selected |{' '}
              <strong className="text-[#03182F]">
                {selectedCost.toFixed(2)} EUR
              </strong>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => submit('reject')}
                disabled={busy}
                className="rounded-xl border border-[#BFCBDA] bg-white px-4 py-2 text-sm font-medium text-[#30373E] hover:bg-slate-50 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => submit('approve')}
                disabled={busy || selectedItems.length === 0}
                className="rounded-xl bg-[#2764FF] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Approve selection
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
