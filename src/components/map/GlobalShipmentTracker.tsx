'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MapViewState, PickingInfo } from '@deck.gl/core'
import MapCanvas from '@/components/map/MapCanvas'
import ShipmentTooltip from '@/components/map/ShipmentTooltip'
import TrackerToolbar from '@/components/map/TrackerToolbar'
import { useShipmentLayers } from '@/hooks/useShipmentLayers'
import { mockShipments } from '@/lib/mockShipments'
import {
  MAP_STYLE_DARK_URL,
  MAP_STYLE_LIGHT_URL,
  aggregatePorts,
  midpointCoordinates,
} from '@/lib/shipmentUtils'
import type { PortCluster, Shipment, ShipmentStatus } from '@/types/shipment'

interface GlobalShipmentTrackerProps {
  shipments?: Shipment[]
  selectedShipmentId?: string
  onShipmentSelect?: (id: string) => void
  height?: number | string
  mapTheme?: 'dark' | 'light'
}

const INITIAL_MAP_VIEW_STATE: MapViewState = {
  longitude: 20,
  latitude: 25,
  zoom: 1.8,
  pitch: 30,
  bearing: 0,
}

const ALL_STATUSES: ShipmentStatus[] = ['on_track', 'in_transit', 'blocked', 'rerouted']

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function interpolateView(
  start: MapViewState,
  end: Partial<MapViewState>,
  progress: number
): MapViewState {
  const p = easeInOutCubic(progress)

  return {
    longitude: start.longitude + ((end.longitude ?? start.longitude) - start.longitude) * p,
    latitude: start.latitude + ((end.latitude ?? start.latitude) - start.latitude) * p,
    zoom: start.zoom + ((end.zoom ?? start.zoom) - start.zoom) * p,
    pitch: start.pitch + ((end.pitch ?? start.pitch) - start.pitch) * p,
    bearing: start.bearing + ((end.bearing ?? start.bearing) - start.bearing) * p,
  }
}

export default function GlobalShipmentTracker({
  shipments,
  selectedShipmentId,
  onShipmentSelect,
  height = 340,
  mapTheme = 'dark',
}: GlobalShipmentTrackerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const mapViewStateRef = useRef<MapViewState>(INITIAL_MAP_VIEW_STATE)
  const focusedSelectionRef = useRef<string | null>(null)

  const [hoveredShipment, setHoveredShipment] = useState<Shipment | null>(null)
  const [hoveredPort, setHoveredPort] = useState<PortCluster | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [activeStatuses, setActiveStatuses] = useState<ShipmentStatus[]>(ALL_STATUSES)
  const [containerWidth, setContainerWidth] = useState(0)
  const [mapViewState, setMapViewState] = useState<MapViewState>(INITIAL_MAP_VIEW_STATE)
  const [blockedPulse, setBlockedPulse] = useState(0)
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null)

  const baseShipments = shipments && shipments.length > 0 ? shipments : mockShipments
  const resolvedSelectedId = selectedShipmentId ?? internalSelectedId
  const mapStyle = mapTheme === 'light' ? MAP_STYLE_LIGHT_URL : MAP_STYLE_DARK_URL

  const enrichedShipments = useMemo(
    () =>
      baseShipments.map((shipment) => ({
        ...shipment,
        isSelected: resolvedSelectedId ? shipment.id === resolvedSelectedId : false,
      })),
    [baseShipments, resolvedSelectedId]
  )

  const allPorts = useMemo(() => aggregatePorts(enrichedShipments), [enrichedShipments])

  const statusCounts = useMemo(() => {
    return enrichedShipments.reduce<Record<ShipmentStatus, number>>(
      (acc, shipment) => {
        acc[shipment.status] += 1
        return acc
      },
      { on_track: 0, in_transit: 0, blocked: 0, rerouted: 0 }
    )
  }, [enrichedShipments])

  const runAnimation = useCallback(
    (
      setter: (value: MapViewState) => void,
      from: MapViewState,
      to: Partial<MapViewState>,
      durationMs: number
    ) => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }

      const startedAt = performance.now()

      const step = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / durationMs)
        setter(interpolateView(from, to, progress))

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(step)
        } else {
          animationFrameRef.current = null
        }
      }

      animationFrameRef.current = requestAnimationFrame(step)
    },
    []
  )

  const handleHover = useCallback((info: PickingInfo) => {
    if (!info.object) {
      setHoveredShipment(null)
      setHoveredPort(null)
      return
    }

    if (typeof info.x === 'number' && typeof info.y === 'number') {
      setTooltipPos({ x: info.x, y: info.y })
    }

    if (info.layer?.id === 'shipment-arcs') {
      setHoveredShipment(info.object as Shipment)
      setHoveredPort(null)
      return
    }

    if (info.layer?.id?.startsWith('shipment-ports')) {
      setHoveredPort(info.object as PortCluster)
      setHoveredShipment(null)
      return
    }

    setHoveredShipment(null)
    setHoveredPort(null)
  }, [])

  const layers = useShipmentLayers(
    enrichedShipments,
    allPorts,
    resolvedSelectedId,
    activeStatuses,
    handleHover,
    blockedPulse
  )

  const handleShipmentSelect = useCallback(
    (id: string) => {
      if (selectedShipmentId === undefined) {
        setInternalSelectedId(id)
      }
      onShipmentSelect?.(id)
    },
    [onShipmentSelect, selectedShipmentId]
  )

  const handleArcClick = useCallback(
    (info: PickingInfo) => {
      if (info.layer?.id !== 'shipment-arcs' || !info.object) return
      const shipment = info.object as Shipment
      handleShipmentSelect(shipment.id)
    },
    [handleShipmentSelect]
  )

  const handleStatusToggle = useCallback((status: ShipmentStatus) => {
    setActiveStatuses((prev) => {
      if (prev.includes(status)) {
        if (prev.length === 1) return prev
        return prev.filter((item) => item !== status)
      }
      return [...prev, status]
    })
  }, [])

  useEffect(() => {
    mapViewStateRef.current = mapViewState
  }, [mapViewState])

  useEffect(() => {
    if (selectedShipmentId !== undefined) return
    if (internalSelectedId) return
    const firstShipmentId = baseShipments[0]?.id
    if (firstShipmentId) {
      setInternalSelectedId(firstShipmentId)
    }
  }, [baseShipments, internalSelectedId, selectedShipmentId])

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0
      setContainerWidth(width)
    })

    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setBlockedPulse((prev) => (prev === 0 ? 2 : 0))
    }, 800)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!resolvedSelectedId) return

    const focusKey = resolvedSelectedId
    if (focusedSelectionRef.current === focusKey) return
    focusedSelectionRef.current = focusKey

    const selected = enrichedShipments.find((shipment) => shipment.id === resolvedSelectedId)
    if (!selected) return

    const [longitude, latitude] = midpointCoordinates(
      selected.origin.coordinates,
      selected.destination.coordinates
    )

    runAnimation(
      setMapViewState,
      mapViewStateRef.current,
      { longitude, latitude, zoom: 3, pitch: 20, bearing: 0 },
      800
    )
  }, [enrichedShipments, resolvedSelectedId, runAnimation])

  const resolvedHeight = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-xl border ${
        mapTheme === 'dark'
          ? 'border-slate-700/70 bg-slate-900'
          : 'border-slate-300 bg-[#EEF3FB]'
      }`}
      style={{ height: resolvedHeight }}
    >
      <div className="absolute inset-0">
        <MapCanvas
          viewState={mapViewState}
          onViewStateChange={setMapViewState}
          mapStyle={mapStyle}
          layers={layers}
          onHover={handleHover}
          onClick={handleArcClick}
        />
      </div>

      <TrackerToolbar
        activeStatuses={activeStatuses}
        statusCounts={statusCounts}
        activeRouteCount={layers.length > 0 ? enrichedShipments.filter((shipment) => activeStatuses.includes(shipment.status)).length : 0}
        onToggleStatus={handleStatusToggle}
      />

      <ShipmentTooltip
        shipment={hoveredShipment}
        port={hoveredPort}
        position={tooltipPos}
        containerWidth={containerWidth}
      />
    </div>
  )
}
