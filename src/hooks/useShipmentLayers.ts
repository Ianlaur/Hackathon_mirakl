import { useMemo } from 'react'
import type { PickingInfo } from '@deck.gl/core'
import { buildShipmentLayers } from '@/components/map/ShipmentLayers'
import { aggregatePorts } from '@/lib/shipmentUtils'
import type { PortCluster, Shipment, ShipmentStatus } from '@/types/shipment'

export function useShipmentLayers(
  shipments: Shipment[],
  ports: PortCluster[],
  selectedId: string | null,
  activeStatuses: ShipmentStatus[],
  onHover: (info: PickingInfo) => void,
  blockedPulse = 0
) {
  return useMemo(() => {
    const filtered = shipments.filter((shipment) => activeStatuses.includes(shipment.status))
    const filteredPorts = filtered.length > 0 ? aggregatePorts(filtered) : ports

    return buildShipmentLayers(filtered, filteredPorts, selectedId, onHover, blockedPulse)
  }, [shipments, ports, selectedId, activeStatuses, onHover, blockedPulse])
}
