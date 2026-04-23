'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import { Color, MeshPhongMaterial } from 'three'

type Parcel = {
  id: string
  type: 'incoming' | 'outgoing'
  status: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned' | 'cancelled'
  tracking_code: string | null
  carrier: string | null
  carrier_url: string | null
  reference: string | null
  sender_name: string | null
  sender_address: string | null
  recipient_name: string | null
  recipient_address: string | null
  weight: number | null
  description: string | null
  notes: string | null
  estimated_date: string | null
  shipped_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
}

type ParcelGlobeProps = {
  parcels: Parcel[]
  selectedParcel: Parcel | null
  onParcelSelect: (parcel: Parcel) => void
  height?: number
  showControls?: boolean
}

type GeoRegion = {
  keywords: string[]
  lat: number
  lng: number
  spreadLat: number
  spreadLng: number
}

type CityCoordinate = {
  keywords: string[]
  label: string
  lat: number
  lng: number
}

type ResolvedLocation = {
  lat: number
  lng: number
  label: string
  confidence: 'city' | 'region' | 'approximate'
}

type GlobeRoute = {
  id: string
  parcel: Parcel
  start: ResolvedLocation
  end: ResolvedLocation
  distance: number
}

type GlobePoint = {
  id: string
  parcelId: string
  parcel: Parcel
  role: 'origin' | 'destination'
  label: string
  lat: number
  lng: number
  color: string
  altitude: number
}

const CITY_COORDINATES: CityCoordinate[] = [
  { keywords: ['paris'], label: 'Paris', lat: 48.8566, lng: 2.3522 },
  { keywords: ['lyon'], label: 'Lyon', lat: 45.764, lng: 4.8357 },
  { keywords: ['marseille'], label: 'Marseille', lat: 43.2965, lng: 5.3698 },
  { keywords: ['lille'], label: 'Lille', lat: 50.6292, lng: 3.0573 },
  { keywords: ['toulouse'], label: 'Toulouse', lat: 43.6047, lng: 1.4442 },
  { keywords: ['nantes'], label: 'Nantes', lat: 47.2184, lng: -1.5536 },
  { keywords: ['bordeaux'], label: 'Bordeaux', lat: 44.8378, lng: -0.5792 },
  { keywords: ['nice'], label: 'Nice', lat: 43.7102, lng: 7.262 },
  { keywords: ['strasbourg'], label: 'Strasbourg', lat: 48.5734, lng: 7.7521 },
  { keywords: ['rennes'], label: 'Rennes', lat: 48.1173, lng: -1.6778 },
  { keywords: ['london', 'londres'], label: 'London', lat: 51.5072, lng: -0.1276 },
  { keywords: ['berlin'], label: 'Berlin', lat: 52.52, lng: 13.405 },
  { keywords: ['madrid'], label: 'Madrid', lat: 40.4168, lng: -3.7038 },
  { keywords: ['barcelona', 'barcelone'], label: 'Barcelona', lat: 41.3874, lng: 2.1686 },
  { keywords: ['rome', 'roma'], label: 'Rome', lat: 41.9028, lng: 12.4964 },
  { keywords: ['milan', 'milano'], label: 'Milan', lat: 45.4642, lng: 9.19 },
  { keywords: ['amsterdam'], label: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
  { keywords: ['brussels', 'bruxelles', 'brussel'], label: 'Brussels', lat: 50.8503, lng: 4.3517 },
  { keywords: ['lisbon', 'lisbonne'], label: 'Lisbon', lat: 38.7223, lng: -9.1393 },
  { keywords: ['vienna', 'vienne'], label: 'Vienna', lat: 48.2082, lng: 16.3738 },
  { keywords: ['warsaw', 'varsovie'], label: 'Warsaw', lat: 52.2297, lng: 21.0122 },
  { keywords: ['prague', 'praga'], label: 'Prague', lat: 50.0755, lng: 14.4378 },
  { keywords: ['zurich', 'zuerich'], label: 'Zurich', lat: 47.3769, lng: 8.5417 },
  { keywords: ['geneva', 'geneve', 'genève'], label: 'Geneva', lat: 46.2044, lng: 6.1432 },
  { keywords: ['new york', 'nyc'], label: 'New York', lat: 40.7128, lng: -74.006 },
  { keywords: ['los angeles'], label: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { keywords: ['san francisco'], label: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { keywords: ['chicago'], label: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { keywords: ['miami'], label: 'Miami', lat: 25.7617, lng: -80.1918 },
  { keywords: ['montreal', 'montréal'], label: 'Montreal', lat: 45.5017, lng: -73.5673 },
  { keywords: ['toronto'], label: 'Toronto', lat: 43.6532, lng: -79.3832 },
  { keywords: ['dubai'], label: 'Dubai', lat: 25.2048, lng: 55.2708 },
  { keywords: ['singapore', 'singapour'], label: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { keywords: ['hong kong'], label: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
  { keywords: ['shanghai'], label: 'Shanghai', lat: 31.2304, lng: 121.4737 },
  { keywords: ['beijing', 'pekin', 'pékin'], label: 'Beijing', lat: 39.9042, lng: 116.4074 },
  { keywords: ['shenzhen'], label: 'Shenzhen', lat: 22.5431, lng: 114.0579 },
  { keywords: ['guangzhou', 'canton'], label: 'Guangzhou', lat: 23.1291, lng: 113.2644 },
  { keywords: ['hangzhou'], label: 'Hangzhou', lat: 30.2741, lng: 120.1551 },
  { keywords: ['chengdu'], label: 'Chengdu', lat: 30.5728, lng: 104.0668 },
  { keywords: ['tokyo'], label: 'Tokyo', lat: 35.6762, lng: 139.6503 },
  { keywords: ['osaka'], label: 'Osaka', lat: 34.6937, lng: 135.5023 },
  { keywords: ['seoul'], label: 'Seoul', lat: 37.5665, lng: 126.978 },
  { keywords: ['sydney'], label: 'Sydney', lat: -33.8688, lng: 151.2093 },
]

const GEO_REGIONS: GeoRegion[] = [
  { keywords: ['france'], lat: 46.2276, lng: 2.2137, spreadLat: 4.5, spreadLng: 5 },
  { keywords: ['germany', 'allemagne', 'deutschland'], lat: 51.1657, lng: 10.4515, spreadLat: 4, spreadLng: 5 },
  { keywords: ['spain', 'espagne', 'espana', 'españa'], lat: 40.4637, lng: -3.7492, spreadLat: 4, spreadLng: 5 },
  { keywords: ['italy', 'italie', 'italia'], lat: 41.8719, lng: 12.5674, spreadLat: 4, spreadLng: 5 },
  { keywords: ['united kingdom', 'uk', 'royaume uni', 'england'], lat: 55.3781, lng: -3.436, spreadLat: 4, spreadLng: 5 },
  { keywords: ['netherlands', 'pays bas'], lat: 52.1326, lng: 5.2913, spreadLat: 2, spreadLng: 3 },
  { keywords: ['belgium', 'belgique'], lat: 50.5039, lng: 4.4699, spreadLat: 2, spreadLng: 2.5 },
  { keywords: ['portugal'], lat: 39.3999, lng: -8.2245, spreadLat: 3, spreadLng: 3 },
  { keywords: ['switzerland', 'suisse'], lat: 46.8182, lng: 8.2275, spreadLat: 2, spreadLng: 2.5 },
  { keywords: ['poland', 'pologne'], lat: 51.9194, lng: 19.1451, spreadLat: 3, spreadLng: 4 },
  { keywords: ['austria', 'autriche'], lat: 47.5162, lng: 14.5501, spreadLat: 2.5, spreadLng: 3 },
  { keywords: ['united states', 'usa', 'etats unis', 'états unis'], lat: 39.8283, lng: -98.5795, spreadLat: 11, spreadLng: 18 },
  { keywords: ['canada'], lat: 56.1304, lng: -106.3468, spreadLat: 10, spreadLng: 20 },
  { keywords: ['china', 'chine'], lat: 35.8617, lng: 104.1954, spreadLat: 10, spreadLng: 18 },
  { keywords: ['japan', 'japon'], lat: 36.2048, lng: 138.2529, spreadLat: 4, spreadLng: 5 },
  { keywords: ['south korea', 'corée du sud', 'coree du sud'], lat: 35.9078, lng: 127.7669, spreadLat: 2.5, spreadLng: 3 },
  { keywords: ['singapore', 'singapour'], lat: 1.3521, lng: 103.8198, spreadLat: 0.2, spreadLng: 0.2 },
  { keywords: ['united arab emirates', 'uae', 'emirats arabes unis'], lat: 23.4241, lng: 53.8478, spreadLat: 2, spreadLng: 3 },
  { keywords: ['australia', 'australie'], lat: -25.2744, lng: 133.7751, spreadLat: 10, spreadLng: 13 },
]

const statusTone: Record<Parcel['status'], string> = {
  pending: 'bg-slate-100 text-[#30373E]',
  in_transit: 'bg-[#2764FF]/10 text-[#004bd9]',
  out_for_delivery: 'bg-[#E0A93A]/10 text-amber-700',
  delivered: 'bg-[#3FA46A]/10 text-emerald-700',
  returned: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-200 text-[#6B7480]',
}

const statusColor: Record<Parcel['status'], string> = {
  pending: '#94a3b8',
  in_transit: '#3b82f6',
  out_for_delivery: '#f59e0b',
  delivered: '#10b981',
  returned: '#f43f5e',
  cancelled: '#64748b',
}

export default function ParcelGlobe({
  parcels,
  selectedParcel,
  onParcelSelect,
  height = 600,
  showControls = true,
}: ParcelGlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const globeRef = useRef<any>(null)
  const [globeWidth, setGlobeWidth] = useState(0)
  const [hoveredParcelId, setHoveredParcelId] = useState<string | null>(null)

  const globeMaterial = useMemo(() => {
    const material = new MeshPhongMaterial()
    material.color = new Color('#0f172a')
    material.emissive = new Color('#1d4ed8')
    material.emissiveIntensity = 0.22
    material.shininess = 0.8
    return material
  }, [])

  const routes = useMemo<GlobeRoute[]>(() => {
    return parcels
      .map((parcel) => {
        const start = resolveLocation(parcel.sender_address, parcel.sender_name, 'origin')
        const end = resolveLocation(parcel.recipient_address, parcel.recipient_name, 'destination')

        if (!start || !end) {
          return null
        }

        return {
          id: parcel.id,
          parcel,
          start,
          end,
          distance: approximateDistanceKm(start.lat, start.lng, end.lat, end.lng),
        }
      })
      .filter((route): route is GlobeRoute => Boolean(route))
  }, [parcels])

  const points = useMemo<GlobePoint[]>(() => {
    return routes.flatMap((route) => {
      const color = statusColor[route.parcel.status]
      return [
        {
          id: `${route.id}-origin`,
          parcelId: route.id,
          parcel: route.parcel,
          role: 'origin',
          label: route.start.label,
          lat: route.start.lat,
          lng: route.start.lng,
          color,
          altitude: 0.03,
        },
        {
          id: `${route.id}-destination`,
          parcelId: route.id,
          parcel: route.parcel,
          role: 'destination',
          label: route.end.label,
          lat: route.end.lat,
          lng: route.end.lng,
          color,
          altitude: 0.03,
        },
      ]
    })
  }, [routes])

  const activeParcelId = selectedParcel?.id ?? hoveredParcelId
  const activeRoute = routes.find((route) => route.id === activeParcelId) ?? routes[0] ?? null
  const mappedRatio = parcels.length === 0 ? 0 : Math.round((routes.length / parcels.length) * 100)

  useEffect(() => {
    if (!containerRef.current) {
      return
    }

    const updateSize = () => {
      setGlobeWidth(containerRef.current?.clientWidth ?? 0)
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe) {
      return
    }

    const controls = globe.controls?.()
    if (controls) {
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.45
      controls.enablePan = false
      controls.minDistance = 180
      controls.maxDistance = 320
    }
  }, [])

  useEffect(() => {
    const globe = globeRef.current
    if (!globe || !activeRoute) {
      return
    }

    globe.pointOfView(
      {
        lat: (activeRoute.start.lat + activeRoute.end.lat) / 2,
        lng: shortestMidpointLng(activeRoute.start.lng, activeRoute.end.lng),
        altitude: 2,
      },
      1200
    )
  }, [activeRoute])

  if (parcels.length === 0) {
    return (
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_45%),linear-gradient(180deg,#0f172a_0%,#1e293b_100%)] p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">Logistics network</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Parcel globe</h2>
        </div>
        <div className="p-6 text-sm text-[#6B7480]">Create parcels with sender and recipient addresses to render routes.</div>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_42%),linear-gradient(180deg,#020617_0%,#0f172a_58%,#172554_100%)] p-6 text-white">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">Live route tracker</p>
            <h2 className="text-3xl font-semibold tracking-tight">Parcel globe</h2>
            <p className="text-sm leading-6 text-slate-300">
              Routes are plotted from sender and recipient addresses already stored on each parcel. Click a route or
              stop to open the parcel details view.
            </p>
          </div>

          {showControls && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCard label="Total" value={parcels.length} />
              <MetricCard label="Mapped" value={routes.length} />
              <MetricCard label="Coverage" value={`${mappedRatio}%`} />
              <MetricCard label="In transit" value={parcels.filter((parcel) => parcel.status === 'in_transit').length} />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
        <div className="space-y-4">
          <div
            ref={containerRef}
            className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.16),_transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]"
            style={{ minHeight: height }}
          >
            {globeWidth > 0 && routes.length > 0 ? (
              <Globe
                ref={globeRef}
                width={globeWidth}
                height={height}
                backgroundColor="rgba(0,0,0,0)"
                globeMaterial={globeMaterial}
                showAtmosphere
                atmosphereColor="#60a5fa"
                atmosphereAltitude={0.18}
                showGraticules
                arcsData={routes}
                arcStartLat={(route: GlobeRoute) => route.start.lat}
                arcStartLng={(route: GlobeRoute) => route.start.lng}
                arcEndLat={(route: GlobeRoute) => route.end.lat}
                arcEndLng={(route: GlobeRoute) => route.end.lng}
                arcColor={(route: GlobeRoute) => {
                  const color = statusColor[route.parcel.status]
                  return route.id === activeParcelId ? [color, '#e0f2fe'] : [color, '#94a3b8']
                }}
                arcAltitudeAutoScale={(route: GlobeRoute) => (route.id === activeParcelId ? 0.34 : 0.22)}
                arcStroke={(route: GlobeRoute) => (route.id === activeParcelId ? 1.4 : 0.75)}
                arcDashLength={(route: GlobeRoute) => (route.parcel.status === 'delivered' ? 1 : 0.55)}
                arcDashGap={(route: GlobeRoute) => (route.parcel.status === 'delivered' ? 0 : 0.7)}
                arcDashAnimateTime={(route: GlobeRoute) => (route.parcel.status === 'delivered' ? 0 : 2400)}
                arcLabel={(route: GlobeRoute) =>
                  `${route.parcel.reference || route.parcel.tracking_code || 'Parcel'}<br/>${route.start.label} → ${route.end.label}`
                }
                onArcClick={(route: object) => onParcelSelect((route as GlobeRoute).parcel)}
                onArcHover={(route: object | null) => setHoveredParcelId(route ? (route as GlobeRoute).id : null)}
                pointsData={points}
                pointLat={(point: GlobePoint) => point.lat}
                pointLng={(point: GlobePoint) => point.lng}
                pointAltitude={(point: GlobePoint) => (point.parcelId === activeParcelId ? 0.06 : point.altitude)}
                pointRadius={(point: GlobePoint) => (point.parcelId === activeParcelId ? 0.34 : 0.24)}
                pointColor={(point: GlobePoint) => point.color}
                pointLabel={(point: GlobePoint) =>
                  `${point.role === 'origin' ? 'Origin' : 'Destination'}<br/>${point.label}<br/>${
                    point.parcel.reference || point.parcel.tracking_code || 'Parcel'
                  }`
                }
                onPointClick={(point: object) => onParcelSelect((point as GlobePoint).parcel)}
                onPointHover={(point: object | null) => setHoveredParcelId(point ? (point as GlobePoint).parcelId : null)}
                ringsData={activeRoute ? [activeRoute.start, activeRoute.end] : []}
                ringLat={(point: ResolvedLocation) => point.lat}
                ringLng={(point: ResolvedLocation) => point.lng}
                ringColor={() => ['#38bdf8', '#60a5fa', '#ffffff00']}
                ringMaxRadius={() => 4}
                ringPropagationSpeed={() => 2.8}
                ringRepeatPeriod={() => 900}
                labelsData={points}
                labelLat={(point: GlobePoint) => point.lat}
                labelLng={(point: GlobePoint) => point.lng}
                labelText={(point: GlobePoint) => point.label}
                labelSize={(point: GlobePoint) => (point.parcelId === activeParcelId ? 0.9 : 0.72)}
                labelColor={() => '#e2e8f0'}
                labelAltitude={() => 0.02}
                labelDotRadius={() => 0.25}
                labelIncludeDot={() => false}
              />
            ) : (
              <div className="flex h-full min-h-[420px] items-center justify-center px-6 text-center text-sm text-slate-300">
                No routable parcels yet. Add sender and recipient addresses to enable globe tracking.
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {routes.slice(0, 6).map((route) => {
              const isActive = route.id === activeParcelId

              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => onParcelSelect(route.parcel)}
                  className={`rounded-lg border p-4 text-left transition ${
                    isActive
                      ? 'border-blue-300 bg-[#2764FF]/10 shadow-sm'
                      : 'border-slate-200 bg-slate-50 hover:border-[#BFCBDA] hover:bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#03182F]">
                        {route.parcel.reference || route.parcel.tracking_code || 'Parcel route'}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#6B7480]">
                        {route.start.label} to {route.end.label}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusTone[route.parcel.status]}`}>
                      {route.parcel.status.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="mt-4 text-sm text-[#6B7480]">
                    {Math.round(route.distance).toLocaleString()} km
                    {' · '}
                    {route.parcel.carrier || 'Carrier not assigned'}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-semibold text-[#03182F]">Focused parcel</h3>
          {activeRoute ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-[#6B7480]">Reference</p>
                <p className="mt-1 text-base font-semibold text-[#03182F]">
                  {activeRoute.parcel.reference || activeRoute.parcel.tracking_code || 'Parcel'}
                </p>
              </div>
              <InfoRow label="Tracking" value={activeRoute.parcel.tracking_code} />
              <InfoRow label="Origin" value={activeRoute.start.label} />
              <InfoRow label="Destination" value={activeRoute.end.label} />
              <InfoRow label="Carrier" value={activeRoute.parcel.carrier} />
              <InfoRow label="Distance" value={`${Math.round(activeRoute.distance).toLocaleString()} km`} />
              <InfoRow
                label="Address quality"
                value={`${activeRoute.start.confidence} origin · ${activeRoute.end.confidence} destination`}
              />
              <button
                type="button"
                onClick={() => onParcelSelect(activeRoute.parcel)}
                className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Open parcel details
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-6 text-[#6B7480]">No parcel route could be mapped from the current data.</p>
          )}

          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-[#03182F]">How route mapping works</p>
            <p className="mt-2 text-sm leading-6 text-[#6B7480]">
              The globe resolves known cities first, then falls back to country-level routing with deterministic placement
              so the same address renders consistently without calling an external geocoding API.
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-sm font-medium text-[#6B7480]">{label}</p>
      <p className="mt-1 text-sm text-[#03182F]">{value || 'Not provided'}</p>
    </div>
  )
}

function resolveLocation(address: string | null, fallback: string | null, role: 'origin' | 'destination'): ResolvedLocation | null {
  const source = [address, fallback].filter(Boolean).join(' ')
  const normalized = normalizeText(source)

  if (!normalized) {
    return null
  }

  const city = CITY_COORDINATES.find((entry) => entry.keywords.some((keyword) => normalized.includes(normalizeText(keyword))))
  if (city) {
    return {
      lat: city.lat,
      lng: city.lng,
      label: city.label,
      confidence: 'city',
    }
  }

  const region = GEO_REGIONS.find((entry) => entry.keywords.some((keyword) => normalized.includes(normalizeText(keyword))))
  if (region) {
    return {
      lat: clamp(region.lat + hashRange(`${normalized}:${role}:lat`, -region.spreadLat, region.spreadLat), -65, 75),
      lng: wrapLng(region.lng + hashRange(`${normalized}:${role}:lng`, -region.spreadLng, region.spreadLng)),
      label: titleCase(findBestKeyword(region.keywords, normalized) || 'Regional route'),
      confidence: 'region',
    }
  }

  return {
    lat: clamp(hashRange(`${normalized}:${role}:global-lat`, -55, 65), -65, 75),
    lng: wrapLng(hashRange(`${normalized}:${role}:global-lng`, -170, 170)),
    label: fallback || compactAddress(address) || 'Approximate route',
    confidence: 'approximate',
  }
}

function approximateDistanceKm(startLat: number, startLng: number, endLat: number, endLng: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRadians(endLat - startLat)
  const dLng = toRadians(endLng - startLng)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(startLat)) * Math.cos(toRadians(endLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return earthRadiusKm * c
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s,.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactAddress(value: string | null) {
  if (!value) {
    return null
  }

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(', ')
}

function hashRange(input: string, min: number, max: number) {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index)
    hash |= 0
  }

  const normalized = (Math.abs(hash) % 10000) / 10000
  return min + normalized * (max - min)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function wrapLng(value: number) {
  if (value > 180) {
    return value - 360
  }
  if (value < -180) {
    return value + 360
  }
  return value
}

function shortestMidpointLng(startLng: number, endLng: number) {
  let diff = endLng - startLng
  if (diff > 180) {
    diff -= 360
  } else if (diff < -180) {
    diff += 360
  }
  return wrapLng(startLng + diff / 2)
}

function findBestKeyword(keywords: string[], normalized: string) {
  return keywords.find((keyword) => normalized.includes(normalizeText(keyword))) || null
}

function titleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
