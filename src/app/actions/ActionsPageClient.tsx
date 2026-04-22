'use client'

import { useMemo, useState } from 'react'
import { RecommendationCard } from './RecommendationCard'
import { RecommendationDetailPanel } from './RecommendationDetailPanel'
import type { RecommendationDTO } from './types'

export default function ActionsPageClient({
  initialRecommendations,
}: {
  initialRecommendations: RecommendationDTO[]
}) {
  const [recommendations, setRecommendations] = useState(initialRecommendations)
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRecommendations[0]?.id ?? null
  )

  const selected = useMemo(
    () => recommendations.find((r) => r.id === selectedId) ?? null,
    [recommendations, selectedId]
  )

  const handleRefresh = async () => {
    const resp = await fetch('/api/copilot/recommendations', { cache: 'no-store' })
    if (!resp.ok) return
    const data = await resp.json()
    if (Array.isArray(data.recommendations)) {
      setRecommendations(data.recommendations as RecommendationDTO[])
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-7xl gap-6 p-6">
      <aside className="flex w-96 shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Actions</h1>
          <button
            type="button"
            onClick={handleRefresh}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Rafraîchir
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {recommendations.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
              {"Aucune action en attente. L'agent vous préviendra dès qu'il détecte un risque."}
            </p>
          )}

          {recommendations.map((r) => (
            <RecommendationCard
              key={r.id}
              recommendation={r}
              selected={r.id === selectedId}
              onSelect={() => setSelectedId(r.id)}
            />
          ))}
        </div>
      </aside>

      <section className="flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6">
        {!selected ? (
          <p className="text-sm text-slate-500">Sélectionne une action à gauche.</p>
        ) : (
          <RecommendationDetailPanel
            recommendation={selected}
            onStatusChange={(next) =>
              setRecommendations((prev) =>
                prev.map((r) => (r.id === next.id ? next : r))
              )
            }
          />
        )}
      </section>
    </div>
  )
}
