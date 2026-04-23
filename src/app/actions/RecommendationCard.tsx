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
      ? { text: 'Pending', className: 'bg-[#E0A93A]/10 text-amber-700' }
      : recommendation.status === 'approved'
        ? { text: 'Approved', className: 'bg-[#3FA46A]/10 text-emerald-700' }
        : recommendation.status === 'rejected'
          ? { text: 'Rejected', className: 'bg-slate-200 text-[#30373E]' }
          : { text: recommendation.status, className: 'bg-slate-200 text-[#30373E]' }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition hover:border-blue-500 ${
        selected ? 'border-blue-600 bg-[#2764FF]/10' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#03182F]">
            {recommendation.title}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-[#6B7480]">
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
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#6B7480]">
          {typeof payload.items_count === 'number' && (
            <span>{payload.items_count} orders</span>
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
