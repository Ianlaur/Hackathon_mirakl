'use client'

import DeckGL from '@deck.gl/react'
import { _GlobeView as GlobeView } from '@deck.gl/core'
import Map from 'react-map-gl/maplibre'
import type { Layer, MapViewState, PickingInfo } from '@deck.gl/core'

const GLOBE_VIEW = new GlobeView()

interface GlobeCanvasProps {
  layers: Layer[]
  viewState: MapViewState
  mapStyle: string
  onHover: (info: PickingInfo) => void
  onClick: (info: PickingInfo) => void
  onViewStateChange: (viewState: MapViewState) => void
}

export default function GlobeCanvas({
  layers,
  viewState,
  mapStyle,
  onHover,
  onClick,
  onViewStateChange,
}: GlobeCanvasProps) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <DeckGL
        views={GLOBE_VIEW}
        controller={true}
        viewState={viewState}
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
