'use client'

import type { RecommendationDTO } from './types'

export function RecommendationCard({
  recommendation,
  selected,
  onSelect,
}: {
  recommendation: RecommendationDTO
  selected: boolean
  onSelect: () => void
}) {
  const payload = recommendation.action_payload
  const isPending = recommendation.status === 'pending_approval'

  const badge =
    recommendation.status === 'pending_approval'
      ? { text: 'À valider', className: 'bg-amber-100 text-amber-700' }
      : recommendation.status === 'approved'
        ? { text: 'Approuvée', className: 'bg-emerald-100 text-emerald-700' }
        : recommendation.status === 'rejected'
          ? { text: 'Rejetée', className: 'bg-slate-200 text-slate-700' }
          : { text: recommendation.status, className: 'bg-slate-200 text-slate-700' }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition hover:border-blue-500 ${
        selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {recommendation.title}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-600">
            {recommendation.reasoning_summary}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
        >
          {badge.text}
        </span>
      </div>

      {payload && isPending && (payload.items_count || payload.total_estimated_cost_eur) ? (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600">
          {typeof payload.items_count === 'number' && (
            <span>{payload.items_count} commandes</span>
          )}
          {typeof payload.total_estimated_cost_eur === 'number' && (
            <>
              {typeof payload.items_count === 'number' && <span>•</span>}
              <span>{payload.total_estimated_cost_eur.toFixed(0)} €</span>
            </>
          )}
          {payload.order_deadline && (
            <>
              <span>•</span>
              <span>Deadline {payload.order_deadline}</span>
            </>
          )}
        </div>
      ) : null}
    </button>
  )
}
