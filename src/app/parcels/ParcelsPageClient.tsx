'use client'

import { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import dynamic from 'next/dynamic'

// Dynamically import globe components to avoid SSR issues
const ParcelGlobe = dynamic(() => import('@/components/ParcelGlobe'), { ssr: false })
const ParcelDetailedView = dynamic(() => import('@/components/ParcelDetailedView'), { ssr: false })

interface Parcel {
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

interface Product {
  id: string
  name: string
  sku: string | null
  quantity: number
  location: string | null
}

interface ParcelItem {
  productId: string | null  // null for new products
  productName: string
  sku: string
  quantity: number
  isNew: boolean
}

interface WMSZone {
  id: string
  name: string
  code: string
  bins: { id: string; code: string; name: string }[]
}

const CARRIERS = [
  // French/European
  { value: 'la_poste', label: 'La Poste' },
  { value: 'colissimo', label: 'Colissimo' },
  { value: 'chronopost', label: 'Chronopost' },
  { value: 'dhl', label: 'DHL' },
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'dpd', label: 'DPD' },
  { value: 'gls', label: 'GLS' },
  { value: 'mondial_relay', label: 'Mondial Relay' },
  { value: 'relais_colis', label: 'Relais Colis' },
  { value: 'tnt', label: 'TNT' },
  { value: 'amazon', label: 'Amazon' },
  // Chinese carriers
  { value: 'sf_express', label: '顺丰 SF Express' },
  { value: 'ems_china', label: 'EMS China' },
  { value: 'china_post', label: '中国邮政 China Post' },
  { value: 'yto_express', label: '圆通 YTO Express' },
  { value: 'zto_express', label: '中通 ZTO Express' },
  { value: 'sto_express', label: '申通 STO Express' },
  { value: 'yunda', label: '韵达 Yunda' },
  { value: 'jd_logistics', label: '京东物流 JD Logistics' },
  { value: 'cainiao', label: '菜鸟 Cainiao' },
  { value: 'yanwen', label: '燕文 Yanwen' },
  { value: '4px', label: '4PX' },
  { value: 'best_express', label: '百世 Best Express' },
  { value: 'other', label: 'Other' },
]

// Carrier detection patterns - regex patterns for auto-detection
const CARRIER_PATTERNS: Record<string, RegExp[]> = {
  // French carriers
  la_poste: [/^[A-Z]{2}\d{9}FR$/i, /^\d{13}$/],
  colissimo: [/^[A-Z]{2}\d{9}FR$/i, /^\d{13}$/],
  chronopost: [/^[A-Z]{2}\d{9}$/i, /^\d{13}$/, /^X[A-Z]\d{11}$/i],
  mondial_relay: [/^\d{8,12}$/],
  
  // International
  dhl: [/^\d{10,11}$/, /^[A-Z]{3}\d{7}$/i, /^\d{12}$/, /^JD\d{18}$/i],
  ups: [/^1Z[A-Z0-9]{16}$/i, /^T\d{10}$/i, /^K\d{10}$/i],
  fedex: [/^\d{12,22}$/, /^\d{15}$/, /^96\d{20}$/],
  dpd: [/^\d{14}$/, /^[A-Z]{3}\d{7}$/i, /^0\d{13}$/],
  gls: [/^\d{11,12}$/, /^[A-Z]{2}\d{9}$/i],
  tnt: [/^\d{9}$/, /^GE\d{9}$/i],
  relais_colis: [/^\d{11}$/],
  amazon: [/^TBA\d{12,}$/i, /^AMZN\d+$/i],
  
  // Chinese carriers
  sf_express: [/^SF\d{12,15}$/i, /^\d{12}$/],
  ems_china: [/^E[A-Z]\d{9}CN$/i, /^[A-Z]{2}\d{9}CN$/i],
  china_post: [/^[A-Z]{2}\d{9}CN$/i, /^R[A-Z]\d{9}CN$/i],
  yto_express: [/^YT\d{15,18}$/i, /^\d{13}$/],
  zto_express: [/^\d{12,14}$/, /^ZT\d{12}$/i, /^78\d{10}$/],
  sto_express: [/^\d{12,13}$/, /^ST\d{12}$/i, /^77\d{10}$/],
  yunda: [/^\d{13}$/, /^YD\d{12}$/i, /^31\d{11}$/],
  jd_logistics: [/^JD[A-Z0-9]{10,15}$/i, /^V[A-Z0-9]{14}$/i],
  cainiao: [/^LP\d{14,18}$/i, /^CAINIAO\d+$/i],
  yanwen: [/^[A-Z]{2}\d{9}[A-Z]{2}$/i, /^S\d{12}$/i],
  '4px': [/^4PX\d{12,16}$/i, /^P0{2,}\d+$/i],
  best_express: [/^\d{12,15}$/, /^7[0-9]\d{10,}$/],
}

// Function to detect carrier from tracking number
function detectCarrierFromTracking(trackingNumber: string): { carrier: string | null; carrierLabel: string | null } {
  if (!trackingNumber || trackingNumber.length < 8) {
    return { carrier: null, carrierLabel: null }
  }
  
  const cleanedNumber = trackingNumber.trim().toUpperCase()
  
  for (const [carrier, patterns] of Object.entries(CARRIER_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(cleanedNumber)) {
        const carrierInfo = CARRIERS.find(c => c.value === carrier)
        return { 
          carrier, 
          carrierLabel: carrierInfo?.label || carrier 
        }
      }
    }
  }
  
  return { carrier: null, carrierLabel: null }
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-[#F2F8FF] text-[#30373E]' },
  in_transit: { label: 'In transit', color: 'bg-[#2764FF]/10 text-[#004bd9]' },
  out_for_delivery: { label: 'Out for delivery', color: 'bg-orange-100 text-orange-700' },
  delivered: { label: 'Delivered', color: 'bg-[#3FA46A]/10 text-green-700' },
  returned: { label: 'Returned', color: 'bg-[#FFE7EC] text-red-700' },
  cancelled: { label: 'Cancelled', color: 'bg-[#F2F8FF] text-[#6B7480]' },
}

const TYPE_CONFIG = {
  incoming: { label: 'Inbound', color: 'bg-[#3FA46A]/10 text-emerald-700' },
  outgoing: { label: 'Outbound', color: 'bg-purple-100 text-purple-700' },
}

// Progression stages for tracking
const TRACKING_STAGES = [
  { key: 'pending', label: 'Prepared', labelIn: 'Ordered' },
  { key: 'picked_up', label: 'Picked up', labelIn: 'Shipped' },
  { key: 'in_transit', label: 'In transit', labelIn: 'In transit' },
  { key: 'customs', label: 'Customs', labelIn: 'Customs' },
  { key: 'out_for_delivery', label: 'Out for delivery', labelIn: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered', labelIn: 'Received' },
]

// Map parcel status to progression step
function getProgressionStep(status: string): number {
  switch (status) {
    case 'pending': return 0
    case 'in_transit': return 2
    case 'out_for_delivery': return 4
    case 'delivered': return 5
    case 'returned': return -1
    case 'cancelled': return -2
    default: return 0
  }
}

// SVG Icons for each stage
const StageIcons = {
  pending: (active: boolean, done: boolean) => (
    <svg className={`w-5 h-5 ${done ? 'text-[#3FA46A]' : active ? 'text-[#2764FF]' : 'text-[#6B7480]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  picked_up: (active: boolean, done: boolean) => (
    <svg className={`w-5 h-5 ${done ? 'text-[#3FA46A]' : active ? 'text-[#2764FF]' : 'text-[#6B7480]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  in_transit: (active: boolean, done: boolean) => (
    <svg className={`w-5 h-5 ${done ? 'text-[#3FA46A]' : active ? 'text-[#2764FF]' : 'text-[#6B7480]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
    </svg>
  ),
  customs: (active: boolean, done: boolean) => (
    <svg className={`w-5 h-5 ${done ? 'text-[#3FA46A]' : active ? 'text-[#E0A93A]' : 'text-[#6B7480]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  out_for_delivery: (active: boolean, done: boolean) => (
    <svg className={`w-5 h-5 ${done ? 'text-[#3FA46A]' : active ? 'text-orange-600' : 'text-[#6B7480]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  delivered: (active: boolean, done: boolean) => (
    <svg className={`w-5 h-5 ${done ? 'text-[#3FA46A]' : active ? 'text-[#3FA46A]' : 'text-[#6B7480]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  returned: () => (
    <svg className="w-5 h-5 text-[#F22E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  ),
  cancelled: () => (
    <svg className="w-5 h-5 text-[#6B7480]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
}

// Progression tracker component
function ProgressionTracker({ status, type }: { status: string; type: 'incoming' | 'outgoing' }) {
  const currentStep = getProgressionStep(status)
  
  // Special cases for returned/cancelled
  if (status === 'returned') {
    return (
      <div className="flex items-center gap-1 text-[#F22E75]">
        {StageIcons.returned()}
        <span className="text-xs font-medium">Returned</span>
      </div>
    )
  }

  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-1 text-[#6B7480]">
        {StageIcons.cancelled()}
        <span className="text-xs font-medium">Cancelled</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-0.5">
      {TRACKING_STAGES.map((stage, index) => {
        const isDone = currentStep > index
        const isActive = currentStep === index
        const IconFn = StageIcons[stage.key as keyof typeof StageIcons] as (active: boolean, done: boolean) => JSX.Element
        
        return (
          <div key={stage.key} className="flex items-center">
            <div 
              className={`relative group ${index > 0 ? '' : ''}`}
              title={type === 'incoming' ? stage.labelIn : stage.label}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                isDone 
                  ? 'bg-[#3FA46A]/10' 
                  : isActive 
                    ? stage.key === 'customs' ? 'bg-[#E0A93A]/10 ring-2 ring-amber-300' : 'bg-[#2764FF]/10 ring-2 ring-blue-300'
                    : 'bg-[#F2F8FF]'
              }`}>
                {IconFn(isActive, isDone)}
              </div>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                {type === 'incoming' ? stage.labelIn : stage.label}
              </div>
            </div>
            {index < TRACKING_STAGES.length - 1 && (
              <div className={`w-2 h-0.5 ${isDone ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Tracking data interface
interface TrackingEvent {
  date: string
  time: string
  datetime: string
  location: string
  status: string
  description: string
  stage: string
}

interface TrackingData {
  success: boolean
  carrier: string | null
  carrierName: string | null
  trackingNumber: string
  status: string
  currentStage: string
  estimatedDelivery: string | null
  origin: string | null
  destination: string | null
  events: TrackingEvent[]
  lastUpdate: string
  error?: string
}

// Map API stage to progression step
function mapStageToStep(stage: string): number {
  const mapping: Record<string, number> = {
    pending: 0,
    picked_up: 1,
    in_transit: 2,
    customs: 3,
    out_for_delivery: 4,
    delivered: 5,
    returned: -1,
    exception: -1,
  }
  return mapping[stage] ?? 0
}

// Live tracking component that fetches real data
function LiveTrackingTracker({
  trackingCode,
  carrier,
  type,
  parcelStatus,
  onTrackingUpdate
}: {
  trackingCode: string | null
  carrier: string | null
  type: 'incoming' | 'outgoing'
  parcelStatus?: string
  onTrackingUpdate?: (status: string, eta: string | null) => void
}) {
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTracking = useCallback(async () => {
    if (!trackingCode) return
    
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      if (carrier) params.append('carrier', carrier)
      
      const res = await fetch(`/api/parcels/track/${encodeURIComponent(trackingCode)}?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setTrackingData(data)
          // Sync status back to DB
          if (onTrackingUpdate) {
            onTrackingUpdate(data.status, data.estimatedDelivery)
          }
        } else if (data.error === 'no_api_key') {
          // No tracking API configured — show carrier link fallback
          setError(null)
          setTrackingData(null)
        } else {
          setError('Unable to retrieve tracking')
        }
      } else {
        setError('Unable to retrieve tracking')
      }
    } catch (err) {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }, [carrier, onTrackingUpdate, trackingCode])

  // Fetch on mount and when tracking code changes
  useEffect(() => {
    if (trackingCode) {
      fetchTracking()
    }
  }, [fetchTracking, trackingCode])

  // No tracking number
  if (!trackingCode) {
    return (
      <div className="flex items-center gap-2 text-[#6B7480] text-sm">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>No tracking #</span>
      </div>
    )
  }

  // Loading
  if (loading && !trackingData) {
    return (
      <div className="flex items-center gap-2">
        <div className="animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full" />
        <span className="text-sm text-[#6B7480]">Loading...</span>
      </div>
    )
  }

  // Error
  if (error && !trackingData) {
    return (
      <button 
        onClick={fetchTracking}
        className="flex items-center gap-2 text-[#F22E75] text-sm hover:text-red-700"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{error} - Retry</span>
      </button>
    )
  }

  if (!trackingData) {
    // No live tracking data — show the DB-stored status with the static progression tracker
    if (parcelStatus) {
      return <ProgressionTracker status={parcelStatus} type={type} />
    }
    return null
  }

  const currentStep = mapStageToStep(trackingData.currentStage)

  return (
    <div className="space-y-2">
      {/* Progress bar with icons */}
      <div className="flex items-center gap-0.5">
        {TRACKING_STAGES.map((stage, index) => {
          const isDone = currentStep > index
          const isActive = currentStep === index
          const IconFn = StageIcons[stage.key as keyof typeof StageIcons] as (active: boolean, done: boolean) => JSX.Element
          
          return (
            <div key={stage.key} className="flex items-center">
              <div 
                className="relative group cursor-pointer"
                title={type === 'incoming' ? stage.labelIn : stage.label}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                  isDone 
                    ? 'bg-[#3FA46A]/10' 
                    : isActive 
                      ? stage.key === 'customs' ? 'bg-[#E0A93A]/10 ring-2 ring-amber-300' : 'bg-[#2764FF]/10 ring-2 ring-blue-300'
                      : 'bg-[#F2F8FF]'
                }`}>
                  {IconFn(isActive, isDone)}
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {type === 'incoming' ? stage.labelIn : stage.label}
                  {isActive && trackingData.events[0] && (
                    <div className="text-[#6B7480] text-[10px]">{trackingData.events[0].location}</div>
                  )}
                </div>
              </div>
              {index < TRACKING_STAGES.length - 1 && (
                <div className={`w-2 h-0.5 ${isDone ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          )
        })}
        
        {/* Expand/refresh button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-2 p-1 text-[#6B7480] hover:text-indigo-600 transition"
          title="View details"
        >
          <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {loading && (
          <div className="animate-spin w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full ml-1" />
        )}
      </div>

      {/* ETA */}
      {trackingData.estimatedDelivery && trackingData.currentStage !== 'delivered' && (
        <div className="text-xs text-[#6B7480]">
          ETA: <span className="font-medium text-[#30373E]">
            {format(new Date(trackingData.estimatedDelivery), 'dd MMM yyyy')}
          </span>
        </div>
      )}

      {/* Expanded events */}
      {expanded && (
        <div className="mt-3 bg-[#F2F8FF] rounded-lg p-3 text-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-[#30373E]">Tracking history</span>
            <button
              onClick={(e) => { e.stopPropagation(); fetchTracking() }}
              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {trackingData.events.length === 0 ? (
            <p className="text-[#6B7480] text-center py-2">No events</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {trackingData.events.slice(0, 10).map((event, idx) => (
                <div key={idx} className="flex gap-3 text-xs">
                  <div className="w-20 flex-shrink-0 text-[#6B7480]">
                    <div>{event.date}</div>
                    <div>{event.time}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[#30373E]">{event.description}</div>
                    {event.location && (
                      <div className="text-[#6B7480]">{event.location}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {trackingData.origin && trackingData.destination && (
            <div className="mt-2 pt-2 border-t border-[#DDE5EE] text-xs text-[#6B7480]">
              {trackingData.origin} → {trackingData.destination}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Toast notification component
function CarrierToast({ 
  message, 
  type, 
  onClose 
}: { 
  message: string
  type: 'detected' | 'changed' | 'info'
  onClose: () => void 
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = type === 'detected' ? 'bg-[#3FA46A]/100' : type === 'changed' ? 'bg-[#E0A93A]/100' : 'bg-indigo-500'
  const icon = type === 'detected' ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ) : type === 'changed' ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${bgColor} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-up`}>
      {icon}
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:bg-white/20 rounded p-1">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function ParcelsPageClient() {
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null)
  const [saving, setSaving] = useState(false)

  // Globe view states
  const [viewMode, setViewMode] = useState<'list' | 'globe'>('list')
  const [selectedGlobeParcel, setSelectedGlobeParcel] = useState<Parcel | null>(null)
  const [showDetailedView, setShowDetailedView] = useState(false)

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'detected' | 'changed' | 'info' } | null>(null)

  // Product selection states
  const [products, setProducts] = useState<Product[]>([])
  const [parcelItems, setParcelItems] = useState<ParcelItem[]>([])
  const [wmsZones, setWmsZones] = useState<WMSZone[]>([])
  const [showAddToStockModal, setShowAddToStockModal] = useState(false)
  const [newProductsToAdd, setNewProductsToAdd] = useState<ParcelItem[]>([])
  const [productLocations, setProductLocations] = useState<Record<number, string>>({})
  const [productSearchQuery, setProductSearchQuery] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)

  const [form, setForm] = useState({
    type: 'incoming' as 'incoming' | 'outgoing',
    status: 'pending' as string,
    tracking_code: '',
    carrier: '',
    reference: '',
    sender_name: '',
    sender_address: '',
    recipient_name: '',
    recipient_address: '',
    weight: '',
    description: '',
    notes: '',
    estimated_date: '',
    shipped_at: '',
    delivered_at: '',
  })

  // Load products and WMS zones
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const res = await fetch('/api/products')
        if (res.ok) {
          const data = await res.json()
          setProducts(data)
        }
      } catch (error) {
        console.error('Error loading products:', error)
      }
    }
    const loadWmsZones = async () => {
      try {
        const res = await fetch('/api/wms/zones')
        if (res.ok) {
          const data = await res.json()
          setWmsZones(data)
        }
      } catch (error) {
        console.error('Error loading WMS zones:', error)
      }
    }
    loadProducts()
    loadWmsZones()
  }, [])

  const loadParcels = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.append('search', search)

      const res = await fetch(`/api/parcels?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setParcels(data)
      }
    } catch (error) {
      console.error('Error loading parcels:', error)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    loadParcels()
  }, [loadParcels])

  const resetForm = () => {
    setForm({
      type: activeTab,
      status: 'pending',
      tracking_code: '',
      carrier: '',
      reference: '',
      sender_name: '',
      sender_address: '',
      recipient_name: '',
      recipient_address: '',
      weight: '',
      description: '',
      notes: '',
      estimated_date: '',
      shipped_at: '',
      delivered_at: '',
    })
    setParcelItems([])
    setProductSearchQuery('')
  }

  // Handler for tracking code changes with auto-detection
  const handleTrackingCodeChange = (trackingCode: string) => {
    const previousCarrier = form.carrier
    const previousCarrierLabel = CARRIERS.find(c => c.value === previousCarrier)?.label

    const { carrier: detectedCarrier, carrierLabel } = detectCarrierFromTracking(trackingCode)

    // Update form with new tracking code
    if (detectedCarrier) {
      // Carrier was detected
      if (previousCarrier && previousCarrier !== detectedCarrier) {
        // Carrier changed - show warning toast
        setToast({
          message: `Carrier changed: ${previousCarrierLabel} → ${carrierLabel}`,
          type: 'changed'
        })
      } else if (!previousCarrier) {
        // New carrier detected
        setToast({
          message: `Carrier detected: ${carrierLabel}`,
          type: 'detected'
        })
      }
      setForm({ ...form, tracking_code: trackingCode, carrier: detectedCarrier })
    } else {
      // No carrier detected, just update tracking code
      setForm({ ...form, tracking_code: trackingCode })
    }
  }

  // Product handling functions
  const addExistingProduct = (product: Product) => {
    const existing = parcelItems.find(item => item.productId === product.id)
    if (existing) {
      setParcelItems(parcelItems.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setParcelItems([...parcelItems, {
        productId: product.id,
        productName: product.name,
        sku: product.sku || '',
        quantity: 1,
        isNew: false
      }])
    }
    setProductSearchQuery('')
    setShowProductDropdown(false)
  }

  const addNewProduct = () => {
    if (!productSearchQuery.trim()) return
    setParcelItems([...parcelItems, {
      productId: null,
      productName: productSearchQuery.trim(),
      sku: '',
      quantity: 1,
      isNew: true
    }])
    setProductSearchQuery('')
    setShowProductDropdown(false)
  }

  const updateItemQuantity = (index: number, qty: number) => {
    if (qty < 1) {
      removeItem(index)
      return
    }
    setParcelItems(parcelItems.map((item, i) => 
      i === index ? { ...item, quantity: qty } : item
    ))
  }

  const updateItemSku = (index: number, sku: string) => {
    setParcelItems(parcelItems.map((item, i) => 
      i === index ? { ...item, sku } : item
    ))
  }

  const removeItem = (index: number) => {
    setParcelItems(parcelItems.filter((_, i) => i !== index))
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(productSearchQuery.toLowerCase()))
  )

  const handleOpenCreate = () => {
    resetForm()
    setEditingParcel(null)
    setShowModal(true)
  }

  const handleOpenEdit = (parcel: Parcel) => {
    setEditingParcel(parcel)
    setForm({
      type: parcel.type,
      status: parcel.status,
      tracking_code: parcel.tracking_code || '',
      carrier: parcel.carrier || '',
      reference: parcel.reference || '',
      sender_name: parcel.sender_name || '',
      sender_address: parcel.sender_address || '',
      recipient_name: parcel.recipient_name || '',
      recipient_address: parcel.recipient_address || '',
      weight: parcel.weight?.toString() || '',
      description: parcel.description || '',
      notes: parcel.notes || '',
      estimated_date: parcel.estimated_date ? parcel.estimated_date.split('T')[0] : '',
      shipped_at: parcel.shipped_at ? parcel.shipped_at.split('T')[0] : '',
      delivered_at: parcel.delivered_at ? parcel.delivered_at.split('T')[0] : '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const method = editingParcel ? 'PATCH' : 'POST'
      // Build description from items
      const itemsDescription = parcelItems.length > 0 
        ? parcelItems.map(item => `${item.quantity}x ${item.productName}${item.sku ? ` (${item.sku})` : ''}`).join(', ')
        : form.description
      const body = editingParcel 
        ? { ...form, id: editingParcel.id, description: itemsDescription, items: parcelItems } 
        : { ...form, description: itemsDescription, items: parcelItems }

      console.log('Saving parcel:', body)

      const res = await fetch('/api/parcels', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      console.log('Response status:', res.status)

      if (res.ok) {
        // Check if there are new products to add to stock (only for incoming parcels)
        const newItems = parcelItems.filter(item => item.isNew)
        if (form.type === 'incoming' && newItems.length > 0) {
          setNewProductsToAdd(newItems)
          setProductLocations({})
          setShowAddToStockModal(true)
        }
        setShowModal(false)
        resetForm()
        setEditingParcel(null)
        loadParcels()
        setToast({ message: 'Parcel saved successfully!', type: 'detected' })
      } else {
        const errorData = await res.json()
        console.error('Error response:', errorData)
        setToast({ message: errorData.error || 'Error saving', type: 'changed' })
      }
    } catch (error) {
      console.error('Error saving parcel:', error)
      setToast({ message: 'Connection error', type: 'changed' })
    } finally {
      setSaving(false)
    }
  }

  // Add new products to stock
  const handleAddProductsToStock = async () => {
    setSaving(true)
    try {
      for (let i = 0; i < newProductsToAdd.length; i++) {
        const item = newProductsToAdd[i]
        const location = productLocations[i] || ''
        
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: item.productName,
            sku: item.sku || null,
            quantity: item.quantity,
            min_quantity: 0,
            selling_price: 0,
            unit: 'piece',
            location: location || null,
          }),
        })
      }
      
      // Reload products list
      const res = await fetch('/api/products')
      if (res.ok) {
        const data = await res.json()
        setProducts(data)
      }
      
      setShowAddToStockModal(false)
      setNewProductsToAdd([])
      setProductLocations({})
    } catch (error) {
      console.error('Error adding products to stock:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this parcel?')) return

    try {
      const res = await fetch(`/api/parcels?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        loadParcels()
      }
    } catch (error) {
      console.error('Error deleting parcel:', error)
    }
  }

  const handleStatusChange = async (parcel: Parcel, newStatus: string) => {
    // Optimistic update
    setParcels(prev => prev.map(p =>
      p.id === parcel.id ? { ...p, status: newStatus as Parcel['status'] } : p
    ))
    try {
      const res = await fetch('/api/parcels', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: parcel.id, status: newStatus }),
      })
      if (!res.ok) {
        // Revert on failure
        setParcels(prev => prev.map(p =>
          p.id === parcel.id ? { ...p, status: parcel.status } : p
        ))
      }
    } catch (error) {
      console.error('Error updating status:', error)
      // Revert
      setParcels(prev => prev.map(p =>
        p.id === parcel.id ? { ...p, status: parcel.status } : p
      ))
    }
  }

  // Filter parcels by active tab and status
  const filteredParcels = parcels.filter(p => {
    if (p.type !== activeTab) return false
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    return true
  })

  // Stats per type
  const incomingParcels = parcels.filter(p => p.type === 'incoming')
  const outgoingParcels = parcels.filter(p => p.type === 'outgoing')

  const incomingStats = {
    total: incomingParcels.length,
    pending: incomingParcels.filter(p => p.status === 'pending').length,
    inTransit: incomingParcels.filter(p => p.status === 'in_transit' || p.status === 'out_for_delivery').length,
    delivered: incomingParcels.filter(p => p.status === 'delivered').length,
  }

  const outgoingStats = {
    total: outgoingParcels.length,
    pending: outgoingParcels.filter(p => p.status === 'pending').length,
    inTransit: outgoingParcels.filter(p => p.status === 'in_transit' || p.status === 'out_for_delivery').length,
    delivered: outgoingParcels.filter(p => p.status === 'delivered').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#03182F]">Shipping management</h1>
          <p className="text-[#6B7480] mt-1">Manage your supplier inbounds and customer outbounds</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#F2F8FF] rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'list'
                  ? 'bg-white text-[#03182F] shadow-sm'
                  : 'text-[#30373E] hover:text-[#03182F]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              List
            </button>
            <button
              onClick={() => setViewMode('globe')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                viewMode === 'globe'
                  ? 'bg-white text-[#03182F] shadow-sm'
                  : 'text-[#30373E] hover:text-[#03182F]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Globe
            </button>
          </div>
          
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <span>+</span> New shipment
          </button>
        </div>
      </div>

      {/* Globe View */}
      {viewMode === 'globe' && (
        <div className="space-y-4">
          <ParcelGlobe
            parcels={parcels}
            selectedParcel={selectedGlobeParcel}
            onParcelSelect={(parcel) => {
              setSelectedGlobeParcel(parcel)
              setShowDetailedView(true)
            }}
            height={600}
            showControls={true}
          />
          
          {/* Quick stats below globe */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-[#DDE5EE]">
              <p className="text-[#6B7480] text-sm">Total parcels</p>
              <p className="text-2xl font-bold text-[#03182F]">{parcels.length}</p>
            </div>
            <div className="bg-[#3FA46A]/10 rounded-xl p-4 border border-emerald-200">
              <p className="text-[#3FA46A] text-sm">Inbound</p>
              <p className="text-2xl font-bold text-emerald-700">{parcels.filter(p => p.type === 'incoming').length}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <p className="text-purple-600 text-sm">Outbound</p>
              <p className="text-2xl font-bold text-purple-700">{parcels.filter(p => p.type === 'outgoing').length}</p>
            </div>
            <div className="bg-[#2764FF]/10 rounded-xl p-4 border border-blue-200">
              <p className="text-[#2764FF] text-sm">In transit</p>
              <p className="text-2xl font-bold text-[#004bd9]">{parcels.filter(p => p.status === 'in_transit').length}</p>
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <>
      {/* Tab Cards - Incoming vs Outgoing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Incoming Tab */}
        <button
          onClick={() => setActiveTab('incoming')}
          className={`text-left p-6 rounded-xl border-2 transition-all ${
            activeTab === 'incoming'
              ? 'bg-[#3FA46A]/10 border-emerald-500 shadow-lg'
              : 'bg-white border-[#DDE5EE] hover:border-emerald-300 hover:bg-[#3FA46A]/10/50'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-[#03182F]">Inbound</h2>
              <p className="text-sm text-[#6B7480]">Supplier orders</p>
            </div>
            <div className="text-3xl font-bold text-[#3FA46A]">{incomingStats.total}</div>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-[#E0A93A]">{incomingStats.pending} pending</span>
            <span className="text-[#2764FF]">{incomingStats.inTransit} in transit</span>
            <span className="text-[#3FA46A]">{incomingStats.delivered} received</span>
          </div>
        </button>

        {/* Outgoing Tab */}
        <button
          onClick={() => setActiveTab('outgoing')}
          className={`text-left p-6 rounded-xl border-2 transition-all ${
            activeTab === 'outgoing'
              ? 'bg-purple-50 border-purple-500 shadow-lg'
              : 'bg-white border-[#DDE5EE] hover:border-purple-300 hover:bg-purple-50/50'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-[#03182F]">Outbound</h2>
              <p className="text-sm text-[#6B7480]">Customer shipments</p>
            </div>
            <div className="text-3xl font-bold text-purple-600">{outgoingStats.total}</div>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-[#E0A93A]">{outgoingStats.pending} to ship</span>
            <span className="text-[#2764FF]">{outgoingStats.inTransit} in transit</span>
            <span className="text-[#3FA46A]">{outgoingStats.delivered} delivered</span>
          </div>
        </button>
      </div>

      {/* Section Header */}
      <div className={`rounded-xl p-4 ${activeTab === 'incoming' ? 'bg-[#3FA46A]/10' : 'bg-purple-100'}`}>
        <h3 className="font-semibold text-[#03182F]">
          {activeTab === 'incoming' ? 'Inbound - Supplier orders' : 'Outbound - Customer shipments'}
        </h3>
        <p className="text-sm text-[#30373E]">
          {activeTab === 'incoming'
            ? 'Track parcels you are expecting from your suppliers'
            : 'Track parcels you are sending to your customers'}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-white rounded-xl p-4 shadow-sm border border-[#DDE5EE]">
        <input
          type="text"
          placeholder="Search (tracking #, reference, carrier...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2 border border-[#BFCBDA] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-[#BFCBDA] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_transit">In transit</option>
          <option value="out_for_delivery">Out for delivery</option>
          <option value="delivered">{activeTab === 'incoming' ? 'Received' : 'Delivered'}</option>
          <option value="returned">Returned</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Parcels List */}
      <div className="bg-white rounded-xl shadow-sm border border-[#DDE5EE] overflow-hidden">
        {filteredParcels.length === 0 ? (
          <div className="text-center py-12 text-[#6B7480]">
            <p className="text-lg">
              {activeTab === 'incoming'
                ? 'No inbound parcels found'
                : 'No outbound parcels found'}
            </p>
            <button
              onClick={handleOpenCreate}
              className="mt-4 text-indigo-600 hover:underline"
            >
              {activeTab === 'incoming'
                ? 'Add a supplier inbound'
                : 'Add a customer outbound'}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredParcels.map((parcel) => {
              const statusConfig = STATUS_CONFIG[parcel.status]

              return (
                <div key={parcel.id} className="p-4 hover:bg-[#F2F8FF] transition">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        {parcel.tracking_code ? (
                          parcel.carrier_url ? (
                            <a
                              href={parcel.carrier_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-800 font-mono text-sm font-medium flex items-center gap-1"
                            >
                              {parcel.tracking_code}
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          ) : (
                            <span className="font-mono text-sm font-medium text-[#03182F]">{parcel.tracking_code}</span>
                          )
                        ) : (
                          <span className="text-[#6B7480] text-sm italic">No tracking #</span>
                        )}
                        {parcel.type === 'incoming' ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_CONFIG.incoming.color}`}>{TYPE_CONFIG.incoming.label}</span>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_CONFIG.outgoing.color}`}>{TYPE_CONFIG.outgoing.label}</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-[#30373E]">
                        {parcel.carrier && (
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4 text-[#6B7480]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                            </svg>
                            {CARRIERS.find(c => c.value === parcel.carrier)?.label || parcel.carrier}
                          </span>
                        )}
                        {parcel.type === 'incoming' ? (
                          parcel.sender_name && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-[#6B7480]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              {parcel.sender_name}
                            </span>
                          )
                        ) : (
                          parcel.recipient_name && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4 text-[#6B7480]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {parcel.recipient_name}
                            </span>
                          )
                        )}
                        {parcel.description && (
                          <span className="text-[#6B7480] truncate max-w-[200px]" title={parcel.description}>
                            {parcel.description}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={parcel.status}
                        onChange={(e) => handleStatusChange(parcel, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-lg border cursor-pointer ${STATUS_CONFIG[parcel.status]?.color || 'bg-[#F2F8FF] text-[#30373E]'}`}
                        title="Change status"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_transit">In transit</option>
                        <option value="out_for_delivery">Out for delivery</option>
                        <option value="delivered">{parcel.type === 'incoming' ? 'Received' : 'Delivered'}</option>
                        <option value="returned">Returned</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <button
                        onClick={() => handleOpenEdit(parcel)}
                        className="p-1.5 text-[#6B7480] hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedGlobeParcel(parcel)
                          setShowDetailedView(true)
                        }}
                        className="p-1.5 text-[#6B7480] hover:text-[#2764FF] hover:bg-[#2764FF]/10 rounded transition"
                        title="View on globe"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(parcel.id)}
                        className="p-1.5 text-[#6B7480] hover:text-[#F22E75] hover:bg-[#FFE7EC] rounded transition"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Live tracking progression */}
                  <LiveTrackingTracker
                    trackingCode={parcel.tracking_code}
                    carrier={parcel.carrier}
                    type={parcel.type}
                    parcelStatus={parcel.status}
                    onTrackingUpdate={async (status, eta) => {
                      // Persist tracking status back to the database
                      try {
                        await fetch('/api/parcels', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            id: parcel.id,
                            status,
                            ...(eta ? { estimated_date: eta } : {}),
                          }),
                        })
                        // Update local state without full reload
                        setParcels(prev => prev.map(p =>
                          p.id === parcel.id
                            ? { ...p, status: status as Parcel['status'], ...(eta ? { estimated_date: eta } : {}) }
                            : p
                        ))
                      } catch (err) {
                        console.error('Failed to sync tracking status:', err)
                      }
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
        </>
      )}

      {/* Parcel Detailed View Modal (Globe) */}
      {showDetailedView && selectedGlobeParcel && (
        <ParcelDetailedView
          parcel={selectedGlobeParcel}
          onClose={() => {
            setShowDetailedView(false)
            setSelectedGlobeParcel(null)
          }}
        />
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#DDE5EE]">
              <h2 className="text-xl font-semibold text-[#03182F]">
                {editingParcel ? 'Edit' : 'Add'} {form.type === 'incoming' ? 'an inbound parcel' : 'an outbound parcel'}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              {/* Type Toggle Buttons */}
              <div>
                <label className="block text-sm font-medium text-[#30373E] mb-2">Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'incoming' })}
                    className={`p-4 rounded-xl border-2 text-left transition ${
                      form.type === 'incoming'
                        ? 'border-emerald-500 bg-[#3FA46A]/10'
                        : 'border-[#DDE5EE] hover:border-emerald-300'
                    }`}
                  >
                    <div className="font-semibold mb-1">Inbound</div>
                    <p className="text-xs text-[#6B7480]">Supplier order</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'outgoing' })}
                    className={`p-4 rounded-xl border-2 text-left transition ${
                      form.type === 'outgoing'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-[#DDE5EE] hover:border-purple-300'
                    }`}
                  >
                    <div className="font-semibold mb-1">Outbound</div>
                    <p className="text-xs text-[#6B7480]">Customer shipment</p>
                  </button>
                </div>
              </div>

              {/* Tracking & Carrier */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#30373E] mb-1">Tracking number</label>
                  <p className="text-xs text-[#6B7480] mb-2">The carrier will be detected automatically</p>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.tracking_code}
                      onChange={(e) => handleTrackingCodeChange(e.target.value)}
                      placeholder="e.g. 1Z999AA10123456784"
                      className="w-full px-3 py-2 border border-[#BFCBDA] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono pr-10"
                    />
                    {form.tracking_code && form.carrier && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#3FA46A]/10 text-green-800">
                          ✓
                        </span>
                      </div>
                    )}
                  </div>
                  {form.tracking_code && form.carrier && (
                    <p className="text-xs text-[#3FA46A] mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Carrier detected: {CARRIERS.find(c => c.value === form.carrier)?.label}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#30373E] mb-1">Carrier</label>
                  <p className="text-xs text-[#6B7480] mb-2">Auto-detected or select manually</p>
                  <select
                    value={form.carrier}
                    onChange={(e) => setForm({ ...form, carrier: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                      form.carrier ? 'border-green-300 bg-[#3FA46A]/10' : 'border-[#BFCBDA]'
                    }`}
                  >
                    <option value="">Select...</option>
                    {CARRIERS.map(carrier => (
                      <option key={carrier.value} value={carrier.value}>{carrier.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference & Description */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#30373E] mb-1">Internal reference</label>
                  <input
                    type="text"
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    placeholder="e.g. ORD-2024-001"
                    className="w-full px-3 py-2 border border-[#BFCBDA] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#30373E] mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: e.target.value })}
                    placeholder="e.g. 2.5"
                    className="w-full px-3 py-2 border border-[#BFCBDA] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Product Content Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-[#30373E]">Parcel contents</label>
                
                {/* Product Search/Add */}
                <div className="relative">
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value)
                      setShowProductDropdown(true)
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                    onBlur={() => {
                      // Delay to allow click events on dropdown items
                      setTimeout(() => setShowProductDropdown(false), 200)
                    }}
                    placeholder="Search a product or add a new one..."
                    className="w-full px-3 py-2 border border-[#BFCBDA] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  
                  {/* Product Dropdown */}
                  {showProductDropdown && productSearchQuery && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-[#DDE5EE] rounded-lg shadow-lg max-h-60 overflow-auto">
                      {filteredProducts.length > 0 && (
                        <div className="p-2 border-b border-[#DDE5EE]">
                          <p className="text-xs text-[#6B7480] font-medium px-2 py-1">Existing products</p>
                          {filteredProducts.slice(0, 5).map(product => (
                            <button
                              key={product.id}
                              type="button"
                              onClick={() => addExistingProduct(product)}
                              className="w-full px-3 py-2 text-left hover:bg-[#F2F8FF] rounded flex items-center justify-between"
                            >
                              <div>
                                <span className="font-medium text-[#03182F]">{product.name}</span>
                                {product.sku && <span className="ml-2 text-xs text-[#6B7480]">SKU: {product.sku}</span>}
                              </div>
                              <span className="text-xs text-[#6B7480]">Stock: {product.quantity}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Add new product option */}
                      <div className="p-2">
                        <button
                          type="button"
                          onClick={addNewProduct}
                          className="w-full px-3 py-2 text-left hover:bg-indigo-50 rounded flex items-center gap-2 text-indigo-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span>Add &quot;{productSearchQuery}&quot; as a new product</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected Items List */}
                {parcelItems.length > 0 && (
                  <div className="border border-[#DDE5EE] rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F2F8FF]">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-[#30373E]">Product</th>
                          <th className="px-3 py-2 text-left font-medium text-[#30373E] w-24">SKU</th>
                          <th className="px-3 py-2 text-center font-medium text-[#30373E] w-24">Qty</th>
                          <th className="px-3 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {parcelItems.map((item, index) => (
                          <tr key={index} className={item.isNew ? 'bg-[#E0A93A]/10' : ''}>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                {item.isNew && (
                                  <span className="px-1.5 py-0.5 text-xs bg-[#E0A93A]/10 text-amber-700 rounded">New</span>
                                )}
                                <span>{item.productName}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {item.isNew ? (
                                <input
                                  type="text"
                                  value={item.sku}
                                  onChange={(e) => updateItemSku(index, e.target.value)}
                                  placeholder="SKU"
                                  className="w-full px-2 py-1 text-xs border border-[#DDE5EE] rounded"
                                />
                              ) : (
                                <span className="text-[#6B7480]">{item.sku || '-'}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateItemQuantity(index, item.quantity - 1)}
                                  className="w-6 h-6 flex items-center justify-center bg-[#F2F8FF] rounded hover:bg-gray-200"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                                  className="w-12 text-center px-1 py-1 border border-[#DDE5EE] rounded text-sm"
                                  min="1"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateItemQuantity(index, item.quantity + 1)}
                                  className="w-6 h-6 flex items-center justify-center bg-[#F2F8FF] rounded hover:bg-gray-200"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                className="text-[#F22E75] hover:text-red-700"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {parcelItems.length === 0 && (
                  <p className="text-sm text-[#6B7480] italic">No products added. Search or create products above.</p>
                )}
              </div>

              {/* Sender/Recipient based on type */}
              {form.type === 'incoming' ? (
                <div className="space-y-4 p-4 bg-[#3FA46A]/10 rounded-lg">
                  <h3 className="font-medium text-emerald-800">Supplier (sender)</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#30373E] mb-1">Supplier name</label>
                      <input
                        type="text"
                        value={form.sender_name}
                        onChange={(e) => setForm({ ...form, sender_name: e.target.value })}
                        placeholder="Amazon, Apple, Alibaba..."
                        className="w-full px-3 py-2 border border-[#BFCBDA] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#30373E] mb-1">Address</label>
                      <input
                        type="text"
                        value={form.sender_address}
                        onChange={(e) => setForm({ ...form, sender_address: e.target.value })}
                        placeholder="Supplier address"
                        className="w-full px-3 py-2 border border-[#BFCBDA] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-4 bg-purple-50 rounded-lg">
                  <h3 className="font-medium text-purple-800">Customer (recipient)</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#30373E] mb-1">Customer name</label>
                      <input
                        type="text"
                        value={form.recipient_name}
                        onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                        placeholder="Customer name"
                        className="w-full px-3 py-2 border border-[#BFCBDA] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#30373E] mb-1">Address</label>
                      <input
                        type="text"
                        value={form.recipient_address}
                        onChange={(e) => setForm({ ...form, recipient_address: e.target.value })}
                        placeholder="Delivery address"
                        className="w-full px-3 py-2 border border-[#BFCBDA] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[#30373E] mb-1">Estimated date</label>
                  <input
                    type="date"
                    value={form.estimated_date}
                    onChange={(e) => setForm({ ...form, estimated_date: e.target.value })}
                    className="w-full px-3 py-2 border border-[#BFCBDA] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#30373E] mb-1">Shipped on</label>
                  <input
                    type="date"
                    value={form.shipped_at}
                    onChange={(e) => setForm({ ...form, shipped_at: e.target.value })}
                    className="w-full px-3 py-2 border border-[#BFCBDA] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#30373E] mb-1">Delivered on</label>
                  <input
                    type="date"
                    value={form.delivered_at}
                    onChange={(e) => setForm({ ...form, delivered_at: e.target.value })}
                    className="w-full px-3 py-2 border border-[#BFCBDA] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-[#30373E] mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-[#BFCBDA] rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-[#DDE5EE] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowModal(false)
                  setEditingParcel(null)
                  resetForm()
                }}
                className="px-4 py-2 text-[#30373E] hover:text-[#03182F] transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  console.log('Save button clicked')
                  handleSave()
                }}
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {editingParcel ? 'Update' : 'Create parcel'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Products to Stock Modal */}
      {showAddToStockModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-[#DDE5EE]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#3FA46A]/10 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#3FA46A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-[#03182F]">Add to stock?</h2>
                  <p className="text-sm text-[#6B7480]">New products detected in this parcel</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-[#30373E]">
                The following products are not yet in your stock. Would you like to add them?
              </p>

              <div className="space-y-3">
                {newProductsToAdd.map((item, index) => (
                  <div key={index} className="p-4 bg-[#F2F8FF] rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-[#03182F]">{item.productName}</span>
                        {item.sku && <span className="ml-2 text-xs text-[#6B7480]">SKU: {item.sku}</span>}
                      </div>
                      <span className="text-sm text-[#30373E]">Qty: {item.quantity}</span>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-[#30373E] mb-1">Storage location</label>
                      <select
                        value={productLocations[index] || ''}
                        onChange={(e) => setProductLocations({ ...productLocations, [index]: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-[#DDE5EE] rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Select a location...</option>
                        {wmsZones.map(zone => (
                          <optgroup key={zone.id} label={zone.name}>
                            {zone.bins.length > 0 ? (
                              zone.bins.map(bin => (
                                <option key={bin.id} value={`${zone.code}-${bin.code}`}>
                                  {zone.code} / {bin.code} - {bin.name}
                                </option>
                              ))
                            ) : (
                              <option value={zone.code}>{zone.code} (entire zone)</option>
                            )}
                          </optgroup>
                        ))}
                        <option value="unassigned">Unassigned</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-[#DDE5EE] flex justify-between gap-3">
              <button
                onClick={() => {
                  setShowAddToStockModal(false)
                  setNewProductsToAdd([])
                  setProductLocations({})
                }}
                className="px-4 py-2 text-[#30373E] hover:text-[#03182F] transition"
              >
                Skip
              </button>
              <button
                onClick={handleAddProductsToStock}
                disabled={saving}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add to stock</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <CarrierToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* CSS Animation for slide-up */}
      <style jsx global>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
