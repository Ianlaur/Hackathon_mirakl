'use client'

import type { PortCluster, Shipment, ShipmentStatus } from '@/types/shipment'
import {
  formatCo2,
  formatCost,
  formatEta,
  getCountryFlagFromLocation,
  getStatusColor,
} from '@/lib/shipmentUtils'

interface ShipmentTooltipProps {
  shipment: Shipment | null
  port: PortCluster | null
  position: { x: number; y: number }
  containerWidth: number
}

export default function ShipmentTooltip({
  shipment,
  port,
  position,
  containerWidth,
}: ShipmentTooltipProps) {
  if (!shipment && !port) return null

  const width = 260
  const shouldFlip = position.x > containerWidth - width
  const left = shouldFlip ? position.x - width - 12 : position.x + 12
  const top = Math.max(12, position.y - 12)

  if (shipment) {
    const status = getStatusColor(shipment.status)

    return (
      <div
        className="pointer-events-none absolute z-30 w-[260px] rounded-xl border border-slate-700/80 bg-slate-950/95 p-3 text-xs text-slate-100 shadow-2xl backdrop-blur"
        style={{ left, top }}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${status.chip}`}
          >
            {status.label}
          </span>
          <span className="font-mono text-[11px] text-slate-300">{shipment.id}</span>
        </div>

        <p className="text-sm font-medium text-white">
          {getCountryFlagFromLocation(shipment.origin.name)} {shipment.origin.name}
          <span className="mx-1 text-slate-400">→</span>
          {getCountryFlagFromLocation(shipment.destination.name)} {shipment.destination.name}
        </p>

        <p className="mt-2 text-slate-300">
          {shipment.freight} <span className="mx-1 text-slate-500">|</span> {formatCost(shipment.cost)}
          <span className="mx-1 text-slate-500">|</span> ETA {formatEta(shipment.eta)}
        </p>
        <p className="mt-1 text-slate-400">{formatCo2(shipment.co2)}</p>
      </div>
    )
  }

  const statusCount = (status: ShipmentStatus) =>
    port?.statuses.filter((item) => item === status).length ?? 0

  return (
    <div
      className="pointer-events-none absolute z-30 w-[260px] rounded-xl border border-slate-700/80 bg-slate-950/95 p-3 text-xs text-slate-100 shadow-2xl backdrop-blur"
      style={{ left, top }}
    >
      <p className="text-sm font-semibold text-white">{port?.name}</p>
      <p className="mt-1 text-slate-300">{port?.shipmentCount} shipments</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {(['on_track', 'in_transit', 'blocked', 'rerouted'] as ShipmentStatus[]).map((status) => {
          const count = statusCount(status)
          if (count === 0) return null

          return (
            <span
              key={status}
              className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] font-medium text-slate-200"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${getStatusColor(status).dot}`} />
              {count}
            </span>
          )
        })}
      </div>
    </div>
  )
}
