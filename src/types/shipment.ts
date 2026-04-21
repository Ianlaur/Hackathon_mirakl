export type ShipmentStatus = 'on_track' | 'in_transit' | 'blocked' | 'rerouted'

export interface GeoPoint {
  name: string
  coordinates: [number, number]
}

export interface Shipment {
  id: string
  product: string
  origin: GeoPoint
  destination: GeoPoint
  status: ShipmentStatus
  eta: string
  freight: string
  cost: number
  co2: number
  isSelected?: boolean
}

export interface PortCluster {
  id: string
  name: string
  coordinates: [number, number]
  shipmentCount: number
  statuses: ShipmentStatus[]
}
