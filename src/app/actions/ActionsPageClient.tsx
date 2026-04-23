'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, X } from 'lucide-react'
import { RecommendationCard } from './RecommendationCard'
import { RecommendationDetailPanel } from './RecommendationDetailPanel'
import type { RecommendationDTO } from './types'

export default function ActionsPageClient({
  initialRecommendations,
}: {
  initialRecommendations: RecommendationDTO[]
}) {
  const [recommendations, setRecommendations] = useState(initialRecommendations)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending_approval' | 'approved' | 'rejected'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(
    initialRecommendations[0]?.id ?? null
  )
  const [isModalOpen, setIsModalOpen] = useState(false)

  const filteredRecommendations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return recommendations.filter((recommendation) => {
      const statusMatch =
        statusFilter === 'all' || recommendation.status === statusFilter

      if (!statusMatch) return false
      if (!normalizedQuery) return true

      return (
        recommendation.title.toLowerCase().includes(normalizedQuery) ||
        recommendation.reasoning_summary.toLowerCase().includes(normalizedQuery) ||
        recommendation.scenario_type.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [recommendations, query, statusFilter])

  const selected = useMemo(
    () => recommendations.find((r) => r.id === selectedId) ?? null,
    [recommendations, selectedId]
  )

  const pendingCount = useMemo(
    () => recommendations.filter((r) => r.status === 'pending_approval').length,
    [recommendations]
  )

  const approvedCount = useMemo(
    () => recommendations.filter((r) => r.status === 'approved').length,
    [recommendations]
  )

  const rejectedCount = useMemo(
    () => recommendations.filter((r) => r.status === 'rejected').length,
    [recommendations]
  )

  const handleRefresh = async () => {
    const resp = await fetch('/api/copilot/recommendations', { cache: 'no-store' })
    if (!resp.ok) return
    const data = await resp.json()
    if (Array.isArray(data.recommendations)) {
      const next = data.recommendations as RecommendationDTO[]
      setRecommendations(next)
      if (selectedId && !next.some((r) => r.id === selectedId)) {
        setSelectedId(null)
        setIsModalOpen(false)
      }
    }
  }

  useEffect(() => {
    if (!isModalOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsModalOpen(false)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isModalOpen])

  const statusTabs = [
    { value: 'all' as const, label: 'All', count: recommendations.length },
    { value: 'pending_approval' as const, label: 'Pending', count: pendingCount },
    { value: 'approved' as const, label: 'Approved', count: approvedCount },
    { value: 'rejected' as const, label: 'Rejected', count: rejectedCount },
  ]

  return (
    <div className="h-[calc(100vh-4rem)] w-full bg-[#F2F8FF]/35">
      <div className="flex h-full flex-col">
        <header className="border-b border-[#DDE5EE] bg-white px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-serif text-[22px] font-bold leading-8 text-[#03182F]">Actions</h1>
              <p className="font-serif text-[14px] leading-6 text-[#6B7480]">
                Review, approve, or reject AI operational decisions.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-[#E0A93A]/10 px-3 py-1 text-[11px] font-bold text-[#E0A93A]">
                {pendingCount} pending
              </span>
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex h-9 items-center gap-2 rounded border border-[#BFCBDA] bg-white px-3 text-[13px] font-bold text-[#30373E] transition-colors hover:bg-[#F2F8FF]"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <section className="min-h-0 flex-1 overflow-hidden">
          <div className="border-b border-[#DDE5EE] bg-white p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-[360px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7480]" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search actions..."
                  className="h-10 w-full rounded border border-[#DDE5EE] bg-white pl-9 pr-3 font-serif text-[13px] text-[#03182F] outline-none focus:border-[#2764FF] focus:ring-1 focus:ring-[#2764FF]"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {statusTabs.map((tab) => {
                  const active = statusFilter === tab.value
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setStatusFilter(tab.value)}
                      className={`rounded-full px-3 py-1 text-[12px] font-bold transition-colors ${
                        active
                          ? 'bg-[#2764FF] text-white'
                          : 'border border-[#DDE5EE] bg-white text-[#30373E] hover:bg-[#F2F8FF]'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="h-full overflow-y-auto p-6">
            {filteredRecommendations.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#BFCBDA] bg-white p-4 text-sm text-[#6B7480]">
                No action matches this filter.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredRecommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.id}
                    recommendation={recommendation}
                    selected={recommendation.id === selectedId}
                    onSelect={() => {
                      setSelectedId(recommendation.id)
                      setIsModalOpen(true)
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {isModalOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
          <button
            type="button"
            aria-label="Close action details"
            onClick={() => setIsModalOpen(false)}
            className="absolute inset-0 bg-[#03182F]/55"
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-[#DDE5EE] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
          >
            <header className="flex items-center justify-between border-b border-[#DDE5EE] bg-[#F2F8FF] px-6 py-4">
              <p className="font-serif text-[16px] font-bold text-[#03182F]">Action Details</p>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#BFCBDA] bg-white text-[#30373E] transition-colors hover:bg-[#F2F8FF]"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-hidden p-6">
              <RecommendationDetailPanel
                recommendation={selected}
                onStatusChange={(next) =>
                  setRecommendations((prev) =>
                    prev.map((recommendation) =>
                      recommendation.id === next.id ? next : recommendation
                    )
                  )
                }
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
