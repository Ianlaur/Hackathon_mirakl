import { ArcLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import type { Layer } from '@deck.gl/core'
import type { PickingInfo } from '@deck.gl/core'
import type { PortCluster, Shipment } from '@/types/shipment'
import { getPortColor, getStatusColor } from '@/lib/shipmentUtils'

type HoverHandler = (info: PickingInfo) => void

function applyAlpha(color: [number, number, number, number], alpha: number) {
  return [color[0], color[1], color[2], Math.round(color[3] * alpha)] as [number, number, number, number]
}

export function buildShipmentLayers(
  shipments: Shipment[],
  ports: PortCluster[],
  selectedId: string | null,
  onHover: HoverHandler,
  blockedPulse = 0
): Layer[] {
  const hasSelection = Boolean(selectedId)

  const arcLayer = new ArcLayer<Shipment>({
    id: 'shipment-arcs',
    data: shipments,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 60],
    greatCircle: true,
    getSourcePosition: (d) => d.origin.coordinates,
    getTargetPosition: (d) => d.destination.coordinates,
    getSourceColor: (d) => {
      const base = getStatusColor(d.status).source
      if (!hasSelection) return base
      return applyAlpha(base, d.isSelected ? 1 : 0.35)
    },
    getTargetColor: (d) => {
      const base = getStatusColor(d.status).target
      if (!hasSelection) return base
      return applyAlpha(base, d.isSelected ? 1 : 0.35)
    },
    getWidth: (d) => {
      const base = d.isSelected ? 4 : 2
      if (d.status === 'blocked') return base + blockedPulse
      return base
    },
    getHeight: 0.4,
    onHover,
    updateTriggers: {
      getSourceColor: [selectedId],
      getTargetColor: [selectedId],
      getWidth: [selectedId, blockedPulse],
    },
  })

  const portsLayer = new ScatterplotLayer<PortCluster>({
    id: 'shipment-ports-outer',
    data: ports,
    pickable: true,
    stroked: true,
    lineWidthMinPixels: 1,
    getPosition: (d) => d.coordinates,
    getRadius: (d) => 60000 + d.shipmentCount * 15000,
    getFillColor: (d) => getPortColor(d.statuses),
    getLineColor: [255, 255, 255, 60],
    onHover,
  })

  const portsInnerLayer = new ScatterplotLayer<PortCluster>({
    id: 'shipment-ports-inner',
    data: ports,
    pickable: false,
    getPosition: (d) => d.coordinates,
    getRadius: 20000,
    getFillColor: [255, 255, 255, 200],
  })

  const textLayer = new TextLayer<PortCluster>({
    id: 'shipment-ports-labels',
    data: ports.filter((port) => port.shipmentCount > 1),
    pickable: false,
    billboard: true,
    getText: (d) => `${d.name} (${d.shipmentCount})`,
    getPosition: (d) => d.coordinates,
    getSize: 11,
    getColor: [255, 255, 255, 180],
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'bottom',
    getPixelOffset: [0, -18],
  })

  return [arcLayer, portsLayer, portsInnerLayer, textLayer]
}
