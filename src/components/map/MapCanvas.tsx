'use client'

import DeckGL from '@deck.gl/react'
import Map from 'react-map-gl/maplibre'
import type { Layer, MapViewState, PickingInfo } from '@deck.gl/core'

interface MapCanvasProps {
  layers: Layer[]
  viewState: MapViewState
  mapStyle: string
  onHover: (info: PickingInfo) => void
  onClick: (info: PickingInfo) => void
  onViewStateChange: (viewState: MapViewState) => void
}

export default function MapCanvas({
  layers,
  viewState,
  mapStyle,
  onHover,
  onClick,
  onViewStateChange,
}: MapCanvasProps) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onHover={onHover}
        onClick={onClick}
        onViewStateChange={({ viewState: nextViewState }) =>
          onViewStateChange(nextViewState as unknown as MapViewState)
        }
      >
        <Map mapStyle={mapStyle} interactive={false} />
      </DeckGL>
    </div>
  )
}
