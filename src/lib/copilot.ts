import { prisma, prismaWithRetry } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { decryptSecret } from '@/lib/crypto'

type SerializableEvidence = Array<{ label: string; value: string }>

type MerchantContext = {
  userId: string
  aiSettings: any | null
  profile: any | null
  stockSummary: {
    totalProducts: number
    lowStockCount: number
    outOfStockCount: number
    totalStockUnits: number
    topLowStockProducts: Array<{ name: string; quantity: number; minQuantity: number; supplier: string | null }>
  }
  parcelSummary: {
    totalParcels: number
    delayedParcels: number
    inTransitParcels: number
    criticalParcels: Array<{ reference: string; status: string; carrier: string | null }>
  }
  warehouseSummary: {
    totalZones: number
    totalBins: number
    pendingPickingLists: number
  }
  calendarEvents: Array<{ title: string; eventType: string; startDate: string; endDate: string; impactLevel: string }>
  externalSignals: Array<{ title: string; summary: string; impactLevel: string; relevanceScore: number; signalType: string }>
}

type ActionSuggestion = {
  title: string
  scenarioType: string
  reasoningSummary: string
  expectedImpact: string
  confidenceNote: string
  target: string
  payload?: Record<string, unknown>
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function normalizeList(raw: string | undefined) {
  return (raw || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function serializeJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function isMissingTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021'
  )
}

function isDatabaseUnavailableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true
  }

  if (!(error instanceof Error)) {
    return false
  }

  return (
    error.message.includes('Environment variable not found: DATABASE_URL') ||
    error.message.includes("Can't reach database server") ||
    error.message.includes('Invalid `prisma.') ||
    error.message.includes('EMAXCONNSESSION') ||
    error.message.includes('max clients reached')
  )
}

function isMissingDelegateError(error: unknown) {
  if (!(error instanceof TypeError)) {
    return false
  }

  return (
    error.message.includes("Cannot read properties of undefined") &&
    (error.message.includes("'findMany'") ||
      error.message.includes("'findUnique'") ||
      error.message.includes("'upsert'"))
  )
}

async function queryWithMissingTableFallback<T>(query: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await query()
  } catch (error) {
    if (
      isMissingTableError(error) ||
      isDatabaseUnavailableError(error) ||
      isMissingDelegateError(error)
    ) {
      return fallback
    }
    throw error
  }
}

export async function getMerchantContext(userId: string): Promise<MerchantContext> {
  const aiSettings = await queryWithMissingTableFallback(
    () => prismaWithRetry((db) => db.merchantAiSettings.findUnique({ where: { user_id: userId } })),
    null
  )
  const profile = await queryWithMissingTableFallback(
    () => prismaWithRetry((db) => db.merchantProfileContext.findUnique({ where: { user_id: userId } })),
    null
  )
  const products = await queryWithMissingTableFallback(
    () =>
      prismaWithRetry((db) =>
        db.product.findMany({
          where: { user_id: userId, active: true },
          select: { name: true, quantity: true, min_quantity: true, supplier: true },
          orderBy: [{ quantity: 'asc' }, { name: 'asc' }],
          take: 50,
        })
      ),
    []
  )
  const parcels = await queryWithMissingTableFallback(
    () =>
      prismaWithRetry((db) =>
        db.parcel.findMany({
          where: { user_id: userId },
          select: { reference: true, status: true, carrier: true },
          orderBy: { updated_at: 'desc' },
          take: 50,
        })
      ),
    []
  )
  const zones = await queryWithMissingTableFallback(
    () =>
      prismaWithRetry((db) =>
        db.warehouseZone.count({ where: { user_id: userId, active: true } })
      ),
    0
  )
  const bins = await queryWithMissingTableFallback(
    () =>
      prismaWithRetry((db) =>
        db.warehouseBin.count({ where: { user_id: userId, active: true } })
      ),
    0
  )
  const pickingLists = await queryWithMissingTableFallback(
    () =>
      prismaWithRetry((db) =>
        db.pickingList.count({
          where: { user_id: userId, status: { in: ['pending', 'in_progress'] } },
        })
      ),
    0
  )
  const calendarEvents = await queryWithMissingTableFallback(
    () =>
      prismaWithRetry((db) =>
        db.merchantCalendarEvent.findMany({
          where: { user_id: userId },
          orderBy: { start_date: 'asc' },
          take: 8,
        })
      ),
    []
  )
  const externalSignals = await queryWithMissingTableFallback(
    () =>
      prismaWithRetry((db) =>
        db.externalContextSignal.findMany({
          where: { user_id: userId },
          orderBy: [{ relevance_score: 'desc' }, { created_at: 'desc' }],
          take: 8,
        })
      ),
    []
  )

  const lowStockProducts = products.filter((product) => product.quantity <= product.min_quantity)
  const outOfStockCount = products.filter((product) => product.quantity === 0).length
  const delayedParcels = parcels.filter((parcel) =>
    ['returned', 'cancelled'].includes(parcel.status)
  ).length
  const inTransitParcels = parcels.filter((parcel) =>
    ['pending', 'in_transit', 'out_for_delivery'].includes(parcel.status)
  ).length

  return {
    userId,
    aiSettings,
    profile,
    stockSummary: {
      totalProducts: products.length,
      lowStockCount: lowStockProducts.length,
      outOfStockCount,
      totalStockUnits: products.reduce((total, product) => total + product.quantity, 0),
      topLowStockProducts: lowStockProducts.slice(0, 5).map((product) => ({
        name: product.name,
        quantity: product.quantity,
        minQuantity: product.min_quantity,
        supplier: product.supplier,
      })),
    },
    parcelSummary: {
      totalParcels: parcels.length,
      delayedParcels,
      inTransitParcels,
      criticalParcels: parcels
        .filter((parcel) => ['returned', 'cancelled', 'out_for_delivery'].includes(parcel.status))
        .slice(0, 5)
        .map((parcel) => ({
          reference: parcel.reference || 'Parcel',
          status: parcel.status,
          carrier: parcel.carrier,
        })),
    },
    warehouseSummary: {
      totalZones: zones,
      totalBins: bins,
      pendingPickingLists: pickingLists,
    },
    calendarEvents: calendarEvents.map((event) => ({
      title: event.title,
      eventType: event.event_type,
      startDate: event.start_date.toISOString(),
      endDate: event.end_date.toISOString(),
      impactLevel: event.impact_level,
    })),
    externalSignals: externalSignals.map((signal) => ({
      title: signal.title,
      summary: signal.summary,
      impactLevel: signal.impact_level,
      relevanceScore: signal.relevance_score,
      signalType: signal.signal_type,
    })),
  }
}

export function buildEvidence(context: MerchantContext): SerializableEvidence {
  const evidence: SerializableEvidence = [
    { label: 'Products tracked', value: `${context.stockSummary.totalProducts}` },
    { label: 'Low stock SKUs', value: `${context.stockSummary.lowStockCount}` },
    { label: 'Out of stock SKUs', value: `${context.stockSummary.outOfStockCount}` },
    { label: 'Parcels in motion', value: `${context.parcelSummary.inTransitParcels}` },
    { label: 'Open planning signals', value: `${context.externalSignals.length}` },
    { label: 'Calendar events', value: `${context.calendarEvents.length}` },
  ]

  if (context.profile?.merchant_category) {
    evidence.push({ label: 'Merchant category', value: context.profile.merchant_category })
  }

  if (context.profile?.operating_regions?.length) {
    evidence.push({
      label: 'Operating regions',
      value: context.profile.operating_regions.join(', '),
    })
  }

  return evidence
}

export function buildHeuristicSuggestions(context: MerchantContext): ActionSuggestion[] {
  const suggestions: ActionSuggestion[] = []

  if (context.stockSummary.lowStockCount > 0) {
    const topRisk = context.stockSummary.topLowStockProducts[0]
    suggestions.push({
      title: `Restock ${topRisk?.name || 'critical products'}`,
      scenarioType: 'restock_risk',
      reasoningSummary:
        context.stockSummary.lowStockCount === 1
          ? `${topRisk?.name || 'A product'} is already at or below its minimum threshold.`
          : `${context.stockSummary.lowStockCount} products are at or below their minimum threshold.`,
      expectedImpact: 'Reduce stockout risk over the next planning cycle.',
      confidenceNote: 'High confidence based on current stock thresholds.',
      target: 'inventory_restock_plan',
      payload: {
        products: context.stockSummary.topLowStockProducts,
      },
    })
  }

  if (context.parcelSummary.delayedParcels > 0) {
    suggestions.push({
      title: 'Review transport disruption impact',
      scenarioType: 'transport_delay',
      reasoningSummary: `${context.parcelSummary.delayedParcels} parcels show a disrupted status that could affect replenishment or delivery promises.`,
      expectedImpact: 'Identify orders or stock positions that need mitigation.',
      confidenceNote: 'Medium confidence; depends on parcel contents and urgency.',
      target: 'transport_exception_review',
      payload: {
        parcels: context.parcelSummary.criticalParcels,
      },
    })
  }

  const absenceEvent = context.calendarEvents.find((event) =>
    ['vacation', 'absence', 'blackout'].includes(event.eventType)
  )

  if (absenceEvent) {
    suggestions.push({
      title: `Plan for ${absenceEvent.title}`,
      scenarioType: 'calendar_absence',
      reasoningSummary: `A calendar event is scheduled from ${absenceEvent.startDate.slice(0, 10)} to ${absenceEvent.endDate.slice(0, 10)} and may affect manual operations.`,
      expectedImpact: 'Prepare stock buffers and operating mode before the absence starts.',
      confidenceNote: 'Medium confidence; merchant review required.',
      target: 'calendar_absence_plan',
      payload: absenceEvent,
    })
  }

  const highSignal = context.externalSignals.find((signal) => signal.relevanceScore >= 70)

  if (highSignal) {
    suggestions.push({
      title: `Assess impact of ${highSignal.title}`,
      scenarioType: 'demand_event',
      reasoningSummary: `A high-relevance external signal suggests a likely change in demand or supply conditions.`,
      expectedImpact: 'Adjust purchasing, stock positioning, or safety stock before the event materializes.',
      confidenceNote: 'Medium confidence; based on external context matching the merchant profile.',
      target: 'demand_event_review',
      payload: highSignal,
    })
  }

  return suggestions
}

async function callOpenAI({
  apiKey,
  model,
  userMessage,
  context,
}: {
  apiKey: string
  model: string
  userMessage: string
  context: MerchantContext
}) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are an operations copilot for a merchant. Always respond in English, regardless of the language used by the merchant. Answer only from the provided context. Return strict JSON with keys answer, reasoningSummary, evidence, recommendations. All string values inside the JSON must be written in English. evidence must be an array of {label,value}. recommendations must be an array of {title,scenarioType,reasoningSummary,expectedImpact,confidenceNote,target,payload}.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            userMessage,
            context,
          }),
        },
      ],
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error('OpenAI response did not include JSON content')
  }

  return safeJsonParse<{
    answer: string
    reasoningSummary: string
    evidence?: SerializableEvidence
    recommendations?: ActionSuggestion[]
  }>(content)
}

export async function generateCopilotResponse(userId: string, userMessage: string) {
  const context = await getMerchantContext(userId)
  const encryptedApiKey = context.aiSettings?.encrypted_api_key
  const heuristicSuggestions = buildHeuristicSuggestions(context)
  const defaultEvidence = buildEvidence(context)
  const envApiKey = process.env.OPENAI_API_KEY?.trim()
  const apiKey = encryptedApiKey ? decryptSecret(encryptedApiKey) : envApiKey

  if (!apiKey) {
    return {
      answer:
        'No OpenAI API key is configured, so I generated an immediate operational response from your current app data.',
      reasoningSummary:
        'No live OpenAI response was available; this answer is grounded in stock, transport, calendar, and context signals already stored in the workspace.',
      evidence: defaultEvidence,
      recommendations: heuristicSuggestions,
      usedModel: 'heuristic_local',
      fallback: true,
      context,
    }
  }

  const model = context.aiSettings?.preferred_model || process.env.OPENAI_MODEL?.trim() || 'gpt-4.1'

  try {
    const modelResponse = await callOpenAI({
      apiKey,
      model,
      userMessage,
      context,
    })

    if (!modelResponse?.answer || !modelResponse?.reasoningSummary) {
      throw new Error('Model response was missing required fields')
    }

    return {
      answer: modelResponse.answer,
      reasoningSummary: modelResponse.reasoningSummary,
      evidence: modelResponse.evidence?.length ? modelResponse.evidence : defaultEvidence,
      recommendations:
        modelResponse.recommendations?.length ? modelResponse.recommendations : heuristicSuggestions,
      usedModel: model,
      fallback: false,
      context,
    }
  } catch (error) {
    console.error('Copilot model call failed, falling back to heuristics:', error)

    return {
      answer:
        'I could not complete the live model call, so I generated a grounded operational summary from your current merchant data. Review the attached recommendations before taking action.',
      reasoningSummary:
        'Fallback response built from current stock thresholds, parcel states, planning events, and external signals already stored in the application.',
      evidence: defaultEvidence,
      recommendations: heuristicSuggestions,
      usedModel: model,
      fallback: true,
      context,
    }
  }
}

export async function getCopilotConfig(userId: string) {
  const [aiSettings, profile] = await Promise.all([
    queryWithMissingTableFallback(
      () => prisma.merchantAiSettings.findUnique({ where: { user_id: userId } }),
      null
    ),
    queryWithMissingTableFallback(
      () => prisma.merchantProfileContext.findUnique({ where: { user_id: userId } }),
      null
    ),
  ])

  return {
    apiKeyConfigured: Boolean(aiSettings?.encrypted_api_key),
    apiKeyHint: aiSettings?.api_key_hint || null,
    preferredModel: aiSettings?.preferred_model || 'gpt-4.1',
    autonomyMode: aiSettings?.autonomy_mode || 'approval_required',
    merchantCategory: profile?.merchant_category || '',
    operatingRegions: profile?.operating_regions || [],
    supplierRegions: profile?.supplier_regions || [],
    supplierNames: profile?.supplier_names || [],
    seasonalityTags: profile?.seasonality_tags || [],
    protectedChannels: profile?.protected_channels || [],
    watchlistKeywords: profile?.watchlist_keywords || [],
    planningNotes: profile?.planning_notes || '',
  }
}

export async function upsertCopilotConfig(
  userId: string,
  payload: {
    apiKey?: string
    preferredModel?: string
    autonomyMode?: string
    merchantCategory?: string
    operatingRegions?: string
    supplierRegions?: string
    supplierNames?: string
    seasonalityTags?: string
    protectedChannels?: string
    watchlistKeywords?: string
    planningNotes?: string
  },
  helpers: {
    encryptSecretValue: (value: string) => string
    maskSecretValue: (value: string) => string
  }
) {
  const aiData = {
    preferred_model: payload.preferredModel || 'gpt-4.1',
    autonomy_mode: payload.autonomyMode || 'approval_required',
    ...(payload.apiKey
      ? {
          encrypted_api_key: helpers.encryptSecretValue(payload.apiKey),
          api_key_hint: helpers.maskSecretValue(payload.apiKey),
        }
      : {}),
  }

  const profileData = {
    merchant_category: payload.merchantCategory || null,
    operating_regions: normalizeList(payload.operatingRegions),
    supplier_regions: normalizeList(payload.supplierRegions),
    supplier_names: normalizeList(payload.supplierNames),
    seasonality_tags: normalizeList(payload.seasonalityTags),
    protected_channels: normalizeList(payload.protectedChannels),
    watchlist_keywords: normalizeList(payload.watchlistKeywords),
    planning_notes: payload.planningNotes || null,
  }

  let aiSettings
  let profile
  try {
    ;[aiSettings, profile] = await Promise.all([
      prisma.merchantAiSettings.upsert({
        where: { user_id: userId },
        update: aiData,
        create: {
          user_id: userId,
          ...aiData,
        },
      }),
      prisma.merchantProfileContext.upsert({
        where: { user_id: userId },
        update: profileData,
        create: {
          user_id: userId,
          ...profileData,
        },
      }),
    ])
  } catch (error) {
    if (
      isMissingTableError(error) ||
      isDatabaseUnavailableError(error) ||
      isMissingDelegateError(error)
    ) {
      throw new Error(
        'Copilot tables are not deployed yet. Run `npm run db:push` with a direct Postgres URL.'
      )
    }
    throw error
  }

  return {
    aiSettings,
    profile,
  }
}
