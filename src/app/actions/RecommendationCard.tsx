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
      ? { text: 'À valider', className: 'bg-[#E0A93A]/10 text-amber-700' }
      : recommendation.status === 'approved'
        ? { text: 'Approuvée', className: 'bg-[#3FA46A]/10 text-emerald-700' }
        : recommendation.status === 'rejected'
          ? { text: 'Rejetée', className: 'bg-slate-200 text-[#30373E]' }
          : { text: recommendation.status, className: 'bg-slate-200 text-[#30373E]' }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-4 text-left transition ${
        selected
          ? 'border-[#2764FF] bg-[#F2F8FF] shadow-[0_1px_4px_rgba(0,0,0,0.1)]'
          : 'border-[#DDE5EE] bg-white hover:border-[#BFCBDA] hover:bg-[#F2F8FF]/40'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-[14px] font-bold leading-6 text-[#03182F]">
            {recommendation.title}
          </p>
          <p className="mt-1 line-clamp-2 font-serif text-[12px] text-[#6B7480]">
            {recommendation.reasoning_summary}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}
        >
          {badge.text}
        </span>
      </div>

      {payload && isPending && (payload.items_count || payload.total_estimated_cost_eur) ? (
        <div className="mt-3 flex flex-wrap gap-2 font-serif text-[11px] text-[#6B7480]">
          {typeof payload.items_count === 'number' && (
            <span className="rounded-full border border-[#DDE5EE] px-2 py-0.5">
              {payload.items_count} commandes
            </span>
          )}
          {typeof payload.total_estimated_cost_eur === 'number' && (
            <span className="rounded-full border border-[#DDE5EE] px-2 py-0.5">
              {payload.total_estimated_cost_eur.toFixed(0)} €
            </span>
          )}
          {payload.order_deadline && (
            <span className="rounded-full border border-[#DDE5EE] px-2 py-0.5">
              Deadline {payload.order_deadline}
            </span>
          )}
        </div>
      ) : null}
    </button>
  )
}
