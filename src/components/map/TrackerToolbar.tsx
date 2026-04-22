'use client'

import { Map as MapIcon } from 'lucide-react'
import type { ShipmentStatus } from '@/types/shipment'
import { getStatusColor } from '@/lib/shipmentUtils'

interface TrackerToolbarProps {
  activeStatuses: ShipmentStatus[]
  statusCounts: Record<ShipmentStatus, number>
  activeRouteCount: number
  onToggleStatus: (status: ShipmentStatus) => void
}

const ORDERED_STATUSES: ShipmentStatus[] = ['on_track', 'in_transit', 'blocked', 'rerouted']

export default function TrackerToolbar({
  activeStatuses,
  statusCounts,
  activeRouteCount,
  onToggleStatus,
}: TrackerToolbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-950/65 px-3 py-2 backdrop-blur">
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-lg bg-slate-900/80 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-100">
        <span className="relative inline-flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        LIVE
        <span className="text-[10px] font-medium text-emerald-300">{activeRouteCount} ACTIVE ROUTES</span>
      </div>

      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
        {ORDERED_STATUSES.map((status) => {
          const isActive = activeStatuses.includes(status)
          const visual = getStatusColor(status)

          return (
            <button
              key={status}
              type="button"
              onClick={() => onToggleStatus(status)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                isActive
                  ? 'bg-slate-800 text-slate-100 ring-1 ring-slate-600'
                  : 'bg-slate-900/60 text-slate-500 ring-1 ring-slate-800'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${visual.dot}`} />
              {visual.label} {statusCounts[status]}
            </button>
          )
        })}
      </div>

      <div className="pointer-events-auto ml-auto inline-flex items-center rounded-full border border-slate-700/70 bg-slate-900/80 p-1 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2.5 py-1 text-white">
          <MapIcon className="h-3.5 w-3.5" /> Map 2D
        </span>
      </div>
    </div>
  )
}
