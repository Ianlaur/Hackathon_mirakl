'use client'

import { useMemo, useState } from 'react'
import type { PlanItemDTO, RecommendationDTO } from './types'

const priorityStyles: Record<PlanItemDTO['priority'], string> = {
  critical: 'bg-rose-100 text-rose-700',
  high: 'bg-[#E0A93A]/10 text-amber-700',
  medium: 'bg-sky-100 text-sky-700',
}

export function RecommendationDetailPanel({
  recommendation,
  onStatusChange,
}: {
  recommendation: RecommendationDTO
  onStatusChange: (next: RecommendationDTO) => void
}) {
  const payload = recommendation.action_payload
  const isPending = recommendation.status === 'pending_approval'
  const items = useMemo(() => payload?.items ?? [], [payload])

  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(items.map((i) => i.product_id))
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedItems = useMemo(
    () => items.filter((i) => checked.has(i.product_id)),
    [items, checked]
  )
  const selectedCost = useMemo(
    () => selectedItems.reduce((s, i) => s + i.estimated_cost_eur, 0),
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
              comment: `Approved on ${selectedItems.length}/${items.length} lines, ${selectedCost.toFixed(2)} €`,
              selected_product_ids: Array.from(checked),
            }
          : {}

      const resp = await fetch(
        `/api/copilot/recommendations/${recommendation.id}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data?.error ?? 'Request failed')
      }
      const data = await resp.json()
      onStatusChange({ ...recommendation, status: data.recommendation.status })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setBusy(false)
    }
  }

  if (!payload) {
    return (
      <p className="font-serif text-[14px] text-[#6B7480]">
        No details available for this action.
      </p>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-[#DDE5EE] pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-serif text-[10px] font-bold uppercase tracking-[0.1em] text-[#6B7480]">
              Leave impact
              {payload.leave_duration_days ? ` • ${payload.leave_duration_days} days` : ''}
            </p>
            <h2 className="mt-1 font-serif text-[18px] font-bold leading-7 text-[#03182F]">
              {recommendation.title}
            </h2>
          </div>
          {payload.order_deadline ? (
            <div className="rounded-lg border border-[#BFCBDA] bg-[#F2F8FF] px-3 py-2 text-right">
              <p className="font-serif text-[10px] uppercase tracking-[0.1em] text-[#6B7480]">
                Order deadline
              </p>
              <p className="font-mono text-[12px] font-semibold text-[#03182F]">{payload.order_deadline}</p>
            </div>
          ) : null}
        </div>
        <p className="mt-3 font-serif text-[14px] leading-6 text-[#30373E]">
          {recommendation.reasoning_summary}
        </p>
        {recommendation.expected_impact && (
          <p className="mt-2 rounded-lg border border-[#DDE5EE] bg-[#F2F8FF] px-3 py-2 font-serif text-[12px] text-[#3FA46A]">
            {recommendation.expected_impact}
          </p>
        )}
      </header>

      {(payload.supplementary_notes?.length ?? 0) > 0 && (
        <div className="mt-4 space-y-1 rounded-lg border border-[#E0A93A]/30 bg-[#E0A93A]/10 p-3">
          {(payload.supplementary_notes ?? []).map((n, idx) => (
            <p key={idx} className="font-serif text-[12px] text-[#30373E]">
              {n}
            </p>
          ))}
        </div>
      )}

      <div className="mt-6 flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F2F8FF] text-[10px] uppercase tracking-[0.1em] text-[#6B7480]">
            <tr>
              <th className="p-3 text-left">☑</th>
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
              <tr key={item.product_id} className="hover:bg-[#F2F8FF]/40">
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
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${priorityStyles[item.priority]}`}
                  >
                    {item.priority}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs text-[#30373E]">{item.sku ?? '—'}</td>
                <td className="p-3 text-[#03182F]">{item.product_name}</td>
                <td className="p-3 text-right tabular-nums">{item.current_stock}</td>
                <td
                  className={`p-3 text-right tabular-nums ${
                    item.projected_stock_end_of_leave < 0
                      ? 'text-rose-700 font-medium'
                      : 'text-[#30373E]'
                  }`}
                >
                  {item.projected_stock_end_of_leave}
                </td>
                <td className="p-3 text-right tabular-nums font-semibold text-[#03182F]">
                  +{item.recommended_qty}
                </td>
                <td className="p-3 text-xs text-[#30373E]">{item.supplier ?? '—'}</td>
                <td className="p-3 text-right tabular-nums">
                  {typeof item.estimated_cost_eur === 'number' ? `${item.estimated_cost_eur.toFixed(2)} €` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isPending && (
        <footer className="mt-6 border-t border-[#DDE5EE] pt-4">
          {error && <p className="mb-3 font-serif text-[13px] text-[#ba1a1a]">{error}</p>}
          <div className="flex items-center justify-between">
            <div className="font-serif text-[13px] text-[#6B7480]">
              {selectedItems.length}/{items.length} lines selected •{' '}
              <strong className="text-[#03182F]">{selectedCost.toFixed(2)} €</strong>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => submit('reject')}
                disabled={busy}
                className="rounded-lg border border-[#BFCBDA] bg-white px-4 py-2 font-serif text-[13px] font-bold text-[#30373E] hover:bg-[#F2F8FF] disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                onClick={() => submit('approve')}
                disabled={busy || selectedItems.length === 0}
                className="rounded-lg bg-[#2764FF] px-4 py-2 font-serif text-[13px] font-bold text-white hover:bg-[#004bd9] disabled:opacity-50"
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
