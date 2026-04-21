import { NextRequest, NextResponse } from 'next/server'

// Carrier detection patterns
const CARRIER_PATTERNS: Record<string, RegExp[]> = {
  // French carriers
  la_poste: [/^[A-Z]{2}\d{9}FR$/i, /^\d{13}$/],
  colissimo: [/^[A-Z]{2}\d{9}FR$/i, /^\d{13}$/],
  chronopost: [/^[A-Z]{2}\d{9}$/i, /^\d{13}$/],
  mondial_relay: [/^\d{8,12}$/],
  
  // International
  dhl: [/^\d{10,11}$/, /^[A-Z]{3}\d{7}$/i, /^\d{12}$/],
  ups: [/^1Z[A-Z0-9]{16}$/i, /^T\d{10}$/i],
  fedex: [/^\d{12,22}$/],
  dpd: [/^\d{14}$/, /^[A-Z]{3}\d{7}$/i],
  gls: [/^\d{11,12}$/],
  tnt: [/^\d{9}$/],
  
  // Chinese carriers
  sf_express: [/^SF\d{12,15}$/i],
  ems_china: [/^E[A-Z]\d{9}CN$/i, /^[A-Z]{2}\d{9}CN$/i],
  china_post: [/^[A-Z]{2}\d{9}CN$/i, /^R[A-Z]\d{9}CN$/i],
  yto_express: [/^YT\d{15,18}$/i, /^\d{13}$/],
  zto_express: [/^\d{12,14}$/, /^ZT\d{12}$/i],
  sto_express: [/^\d{12,13}$/, /^ST\d{12}$/i],
  yunda: [/^\d{13}$/, /^YD\d{12}$/i],
  jd_logistics: [/^JD[A-Z0-9]{10,15}$/i],
  cainiao: [/^LP\d{14,18}$/i, /^CAINIAO\d+$/i],
  yanwen: [/^[A-Z]{2}\d{9}[A-Z]{2}$/i],
  '4px': [/^4PX\d{12,16}$/i],
  best_express: [/^\d{12,15}$/],
}

// Detect carrier from tracking number
function detectCarrier(trackingNumber: string): string | null {
  for (const [carrier, patterns] of Object.entries(CARRIER_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(trackingNumber)) {
        return carrier
      }
    }
  }
  return null
}

// Tracking API URLs for different services
const TRACKING_APIS = {
  // 17track API (universal)
  universal: 'https://api.17track.net/track/v2.2/gettrackinfo',
  // Alternative: Ship24 API
  ship24: 'https://api.ship24.com/public/v1/trackers/track',
}

interface TrackingEvent {
  date: string
  time: string
  datetime: string
  location: string
  status: string
  description: string
  stage: 'pending' | 'picked_up' | 'in_transit' | 'customs' | 'out_for_delivery' | 'delivered' | 'returned' | 'exception'
}

interface TrackingResult {
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

// Map status descriptions to stages
function mapToStage(description: string, status: string): TrackingEvent['stage'] {
  const desc = description.toLowerCase()
  const stat = status.toLowerCase()
  
  // Delivered
  if (desc.includes('delivered') || desc.includes('livré') || desc.includes('remis') || 
      stat.includes('delivered') || desc.includes('签收') || desc.includes('已签收')) {
    return 'delivered'
  }
  
  // Out for delivery
  if (desc.includes('out for delivery') || desc.includes('en cours de livraison') || 
      desc.includes('en livraison') || desc.includes('派送中') || desc.includes('正在派送')) {
    return 'out_for_delivery'
  }
  
  // Customs
  if (desc.includes('customs') || desc.includes('douane') || desc.includes('dédouanement') ||
      desc.includes('clearance') || desc.includes('海关') || desc.includes('清关')) {
    return 'customs'
  }
  
  // In transit
  if (desc.includes('transit') || desc.includes('departed') || desc.includes('arrived') ||
      desc.includes('en route') || desc.includes('acheminé') || desc.includes('tri') ||
      desc.includes('运输中') || desc.includes('已发出') || desc.includes('到达')) {
    return 'in_transit'
  }
  
  // Picked up
  if (desc.includes('picked up') || desc.includes('collected') || desc.includes('pris en charge') ||
      desc.includes('collecté') || desc.includes('accepted') || desc.includes('已揽收')) {
    return 'picked_up'
  }
  
  // Returned
  if (desc.includes('returned') || desc.includes('retour') || desc.includes('undeliverable') ||
      desc.includes('退回') || desc.includes('退件')) {
    return 'returned'
  }
  
  // Exception
  if (desc.includes('exception') || desc.includes('problem') || desc.includes('failed') ||
      desc.includes('anomalie') || desc.includes('异常')) {
    return 'exception'
  }
  
  return 'pending'
}

// Get overall status from events
function getOverallStatus(events: TrackingEvent[]): { status: string; stage: string } {
  if (events.length === 0) {
    return { status: 'pending', stage: 'pending' }
  }
  
  // Find the most advanced stage
  const stageOrder = ['pending', 'picked_up', 'in_transit', 'customs', 'out_for_delivery', 'delivered']
  let maxStageIndex = 0
  
  for (const event of events) {
    if (event.stage === 'returned') {
      return { status: 'returned', stage: 'returned' }
    }
    if (event.stage === 'delivered') {
      return { status: 'delivered', stage: 'delivered' }
    }
    const idx = stageOrder.indexOf(event.stage)
    if (idx > maxStageIndex) {
      maxStageIndex = idx
    }
  }
  
  const stage = stageOrder[maxStageIndex]
  const statusMap: Record<string, string> = {
    pending: 'pending',
    picked_up: 'in_transit',
    in_transit: 'in_transit',
    customs: 'in_transit',
    out_for_delivery: 'out_for_delivery',
    delivered: 'delivered',
  }
  
  return { status: statusMap[stage] || 'in_transit', stage }
}

// Fetch tracking from 17track API
async function fetchFrom17Track(trackingNumber: string, carrier?: string): Promise<TrackingResult | null> {
  const apiKey = process.env.TRACK17_API_KEY
  
  if (!apiKey) {
    console.log('17track API key not configured')
    return null
  }
  
  try {
    const response = await fetch(TRACKING_APIS.universal, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': apiKey,
      },
      body: JSON.stringify([{ number: trackingNumber, carrier: carrier ? mapCarrierTo17Track(carrier) : undefined }]),
    })
    
    if (!response.ok) {
      console.error('17track API error:', response.status)
      return null
    }
    
    const data = await response.json()
    
    if (data.code !== 0 || !data.data?.accepted?.[0]) {
      return null
    }
    
    const trackInfo = data.data.accepted[0]
    const events: TrackingEvent[] = (trackInfo.track?.z0?.z || []).map((e: any) => ({
      date: e.a?.split(' ')[0] || '',
      time: e.a?.split(' ')[1] || '',
      datetime: e.a || '',
      location: e.c || '',
      status: e.z || '',
      description: e.z || '',
      stage: mapToStage(e.z || '', e.z || ''),
    }))
    
    const { status, stage } = getOverallStatus(events)
    
    return {
      success: true,
      carrier: trackInfo.carrier,
      carrierName: trackInfo.carrier_name,
      trackingNumber,
      status,
      currentStage: stage,
      estimatedDelivery: trackInfo.track?.e || null,
      origin: trackInfo.track?.b || null,
      destination: trackInfo.track?.c || null,
      events,
      lastUpdate: new Date().toISOString(),
    }
  } catch (error) {
    console.error('17track fetch error:', error)
    return null
  }
}

// Map our carrier codes to 17track carrier codes
function mapCarrierTo17Track(carrier: string): number | undefined {
  const carrierMap: Record<string, number> = {
    la_poste: 4041,
    colissimo: 4051,
    chronopost: 4031,
    dhl: 100003,
    ups: 100002,
    fedex: 100001,
    dpd: 100049,
    gls: 100050,
    sf_express: 6001,
    ems_china: 3011,
    china_post: 3001,
    yto_express: 6002,
    zto_express: 6003,
    sto_express: 6004,
    yunda: 6005,
    cainiao: 190271,
  }
  return carrierMap[carrier]
}

// Fetch from Ship24 API (alternative)
async function fetchFromShip24(trackingNumber: string): Promise<TrackingResult | null> {
  const apiKey = process.env.SHIP24_API_KEY
  
  if (!apiKey) {
    console.log('Ship24 API key not configured')
    return null
  }
  
  try {
    const response = await fetch(TRACKING_APIS.ship24, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ trackingNumber }),
    })
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    // Parse Ship24 response format...
    // Implementation depends on their response structure
    
    return null // Placeholder
  } catch (error) {
    console.error('Ship24 fetch error:', error)
    return null
  }
}

// Direct carrier API calls for common carriers
async function fetchFromCarrierDirect(trackingNumber: string, carrier: string): Promise<TrackingResult | null> {
  // La Poste / Colissimo API
  if (carrier === 'la_poste' || carrier === 'colissimo') {
    return fetchFromLaPoste(trackingNumber)
  }
  
  // Add more direct carrier integrations as needed
  return null
}

// La Poste tracking
async function fetchFromLaPoste(trackingNumber: string): Promise<TrackingResult | null> {
  const apiKey = process.env.LAPOSTE_API_KEY
  
  if (!apiKey) {
    return null
  }
  
  try {
    const response = await fetch(
      `https://api.laposte.fr/suivi/v2/idships/${trackingNumber}`,
      {
        headers: {
          'Accept': 'application/json',
          'X-Okapi-Key': apiKey,
        },
      }
    )
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    const shipment = data.shipment
    
    if (!shipment) {
      return null
    }
    
    const events: TrackingEvent[] = (shipment.event || []).map((e: any) => ({
      date: e.date?.split('T')[0] || '',
      time: e.date?.split('T')[1]?.substring(0, 5) || '',
      datetime: e.date || '',
      location: e.label || '',
      status: e.code || '',
      description: e.label || '',
      stage: mapToStage(e.label || '', e.code || ''),
    }))
    
    const { status, stage } = getOverallStatus(events)
    
    return {
      success: true,
      carrier: 'la_poste',
      carrierName: 'La Poste',
      trackingNumber,
      status,
      currentStage: stage,
      estimatedDelivery: shipment.deliveryDate || null,
      origin: null,
      destination: null,
      events,
      lastUpdate: new Date().toISOString(),
    }
  } catch (error) {
    console.error('La Poste API error:', error)
    return null
  }
}

// Generate mock tracking for demo/testing
function generateMockTracking(trackingNumber: string, carrier: string | null): TrackingResult {
  const now = new Date()
  const daysAgo = (days: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() - days)
    return d
  }
  
  // Simulate different stages based on tracking number hash
  const hash = trackingNumber.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const stageIndex = hash % 6
  
  const stages = ['pending', 'picked_up', 'in_transit', 'customs', 'out_for_delivery', 'delivered'] as const
  const currentStage = stages[stageIndex]
  
  const events: TrackingEvent[] = []
  
  // Generate events up to current stage
  const eventTemplates = [
    { stage: 'pending', desc: 'Colis préparé pour expédition', descIn: 'Commande expédiée par le fournisseur', days: 5 },
    { stage: 'picked_up', desc: 'Colis collecté par le transporteur', descIn: 'Colis pris en charge', days: 4 },
    { stage: 'in_transit', desc: 'En transit - Centre de tri Paris', descIn: 'Arrivé au centre de tri international', days: 3 },
    { stage: 'customs', desc: 'Dédouanement en cours', descIn: 'En cours de dédouanement', days: 2 },
    { stage: 'out_for_delivery', desc: 'En cours de livraison', descIn: 'En cours de livraison', days: 1 },
    { stage: 'delivered', desc: 'Livré - Signé par le destinataire', descIn: 'Colis reçu', days: 0 },
  ]
  
  for (let i = 0; i <= stageIndex; i++) {
    const template = eventTemplates[i]
    const eventDate = daysAgo(template.days)
    events.push({
      date: eventDate.toISOString().split('T')[0],
      time: `${9 + i * 2}:${(hash % 60).toString().padStart(2, '0')}`,
      datetime: eventDate.toISOString(),
      location: i === 3 ? 'Douane - Roissy CDG' : `Centre ${['Paris', 'Lyon', 'Marseille', 'Shanghai', 'Hong Kong'][i % 5]}`,
      status: template.stage,
      description: carrier?.includes('china') || carrier?.includes('cainiao') ? template.descIn : template.desc,
      stage: template.stage as TrackingEvent['stage'],
    })
  }
  
  // Calculate ETA
  let eta: string | null = null
  if (currentStage !== 'delivered') {
    const etaDate = new Date(now)
    etaDate.setDate(etaDate.getDate() + (6 - stageIndex))
    eta = etaDate.toISOString().split('T')[0]
  }
  
  const statusMap: Record<string, string> = {
    pending: 'pending',
    picked_up: 'in_transit',
    in_transit: 'in_transit',
    customs: 'in_transit',
    out_for_delivery: 'out_for_delivery',
    delivered: 'delivered',
  }
  
  return {
    success: true,
    carrier,
    carrierName: carrier ? CARRIER_NAMES[carrier] || carrier : 'Transporteur inconnu',
    trackingNumber,
    status: statusMap[currentStage] || 'in_transit',
    currentStage,
    estimatedDelivery: eta,
    origin: carrier?.includes('china') || carrier?.includes('cainiao') ? 'Shenzhen, CN' : 'Paris, FR',
    destination: 'Lyon, FR',
    events: events.reverse(), // Most recent first
    lastUpdate: new Date().toISOString(),
  }
}

const CARRIER_NAMES: Record<string, string> = {
  la_poste: 'La Poste',
  colissimo: 'Colissimo',
  chronopost: 'Chronopost',
  dhl: 'DHL',
  ups: 'UPS',
  fedex: 'FedEx',
  dpd: 'DPD',
  gls: 'GLS',
  mondial_relay: 'Mondial Relay',
  tnt: 'TNT',
  sf_express: 'SF Express',
  ems_china: 'EMS China',
  china_post: 'China Post',
  yto_express: 'YTO Express',
  zto_express: 'ZTO Express',
  sto_express: 'STO Express',
  yunda: 'Yunda',
  jd_logistics: 'JD Logistics',
  cainiao: 'Cainiao',
  yanwen: 'Yanwen',
  '4px': '4PX',
  best_express: 'Best Express',
}

export async function GET(
  request: NextRequest,
  { params }: { params: { trackingNumber: string } }
) {
  const trackingNumber = params.trackingNumber.trim().toUpperCase()
  
  if (!trackingNumber || trackingNumber.length < 5) {
    return NextResponse.json({ 
      success: false, 
      error: 'Numéro de suivi invalide' 
    }, { status: 400 })
  }
  
  // Detect carrier from tracking number
  const detectedCarrier = detectCarrier(trackingNumber)
  
  // Try to get carrier from query param
  const url = new URL(request.url)
  const requestedCarrier = url.searchParams.get('carrier') || detectedCarrier
  
  let result: TrackingResult | null = null

  // Try 17track API first
  result = await fetchFrom17Track(trackingNumber, requestedCarrier || undefined)

  // If 17track fails, try direct carrier API
  if (!result && requestedCarrier) {
    result = await fetchFromCarrierDirect(trackingNumber, requestedCarrier)
  }

  // If no API key configured or all APIs fail, return a no-data result
  // (don't fabricate fake tracking events)
  if (!result) {
    return NextResponse.json({
      success: false,
      carrier: requestedCarrier,
      carrierName: requestedCarrier ? CARRIER_NAMES[requestedCarrier] || requestedCarrier : null,
      trackingNumber,
      status: 'unknown',
      currentStage: 'unknown',
      estimatedDelivery: null,
      origin: null,
      destination: null,
      events: [],
      lastUpdate: new Date().toISOString(),
      error: 'no_api_key',
    } satisfies TrackingResult)
  }

  return NextResponse.json(result)
}
