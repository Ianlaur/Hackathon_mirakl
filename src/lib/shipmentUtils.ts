import type { PortCluster, Shipment, ShipmentStatus } from '@/types/shipment'

export const STATUS_COLORS: Record<
  ShipmentStatus,
  {
    source: [number, number, number, number]
    target: [number, number, number, number]
    chip: string
    dot: string
    label: string
  }
> = {
  on_track: {
    source: [52, 211, 153, 220],
    target: [16, 185, 129, 220],
    chip: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30',
    dot: 'bg-emerald-400',
    label: 'On Track',
  },
  in_transit: {
    source: [251, 191, 36, 220],
    target: [245, 158, 11, 220],
    chip: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/30',
    dot: 'bg-amber-400',
    label: 'In Transit',
  },
  blocked: {
    source: [248, 113, 113, 220],
    target: [239, 68, 68, 220],
    chip: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30',
    dot: 'bg-rose-400',
    label: 'Blocked',
  },
  rerouted: {
    source: [129, 140, 248, 220],
    target: [99, 102, 241, 220],
    chip: 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/30',
    dot: 'bg-indigo-400',
    label: 'Rerouted',
  },
}

const STATUS_PRIORITY: ShipmentStatus[] = ['blocked', 'rerouted', 'in_transit', 'on_track']

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim()

export const MAP_STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`
  : 'https://tiles.openfreemap.org/styles/dark'

export const GLOBE_STYLE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/backdrop/style.json?key=${MAPTILER_KEY}`
  : 'https://tiles.openfreemap.org/styles/dark'

export function getStatusColor(status: ShipmentStatus) {
  return STATUS_COLORS[status]
}

export function formatCost(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatEta(etaIso: string) {
  const date = new Date(etaIso)
  if (Number.isNaN(date.getTime())) return etaIso

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatCo2(co2Tons: number) {
  return `${co2Tons.toFixed(1)} t CO₂`
}

export function extractCountryCode(location: string) {
  const parts = location.split(',')
  const code = parts[parts.length - 1]?.trim().toUpperCase()
  if (!code || code.length !== 2) return null
  return code
}

export function countryFlagFromCode(code: string | null) {
  if (!code || code.length !== 2) return '🏳️'
  const chars = code
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0))
  return String.fromCodePoint(...chars)
}

export function getCountryFlagFromLocation(location: string) {
  return countryFlagFromCode(extractCountryCode(location))
}

export function midpointCoordinates(
  origin: [number, number],
  destination: [number, number]
): [number, number] {
  return [
    (origin[0] + destination[0]) / 2,
    (origin[1] + destination[1]) / 2,
  ]
}

export function aggregatePorts(shipments: Shipment[]): PortCluster[] {
  const ports = new Map<string, PortCluster>()

  const upsertPort = (
    id: string,
    name: string,
    coordinates: [number, number],
    status: ShipmentStatus
  ) => {
    const current = ports.get(id)
    if (current) {
      current.shipmentCount += 1
      current.statuses.push(status)
      return
    }

    ports.set(id, {
      id,
      name,
      coordinates,
      shipmentCount: 1,
      statuses: [status],
    })
  }

  for (const shipment of shipments) {
    upsertPort(
      `origin:${shipment.origin.name}`,
      shipment.origin.name,
      shipment.origin.coordinates,
      shipment.status
    )
    upsertPort(
      `dest:${shipment.destination.name}`,
      shipment.destination.name,
      shipment.destination.coordinates,
      shipment.status
    )
  }

  return Array.from(ports.values()).sort((a, b) => b.shipmentCount - a.shipmentCount)
}

export function getDominantStatus(statuses: ShipmentStatus[]): ShipmentStatus {
  const counts = new Map<ShipmentStatus, number>()
  for (const status of statuses) {
    counts.set(status, (counts.get(status) ?? 0) + 1)
  }

  return STATUS_PRIORITY.reduce((best, current) => {
    const currentCount = counts.get(current) ?? 0
    const bestCount = counts.get(best) ?? 0
    return currentCount > bestCount ? current : best
  }, 'on_track' as ShipmentStatus)
}

export function getPortColor(statuses: ShipmentStatus[]): [number, number, number, number] {
  const dominant = getDominantStatus(statuses)
  const color = STATUS_COLORS[dominant].source
  return [color[0], color[1], color[2], 200]
}
