import 'server-only'

import { mockShipments } from '@/lib/mockShipments'
import type {
  ChatMessage,
  DayBriefingData,
  DayTag,
  QuestionSuggestions,
  QuickActionId,
} from '@/types/copilot'
import type { ShipmentStatus } from '@/types/shipment'

type StockAlertLevel = 'critical' | 'attention' | 'ok'

type StockAlert = {
  warehouse: string
  product: string
  level: StockAlertLevel
  quantity: number
  minQuantity: number
}

type ShipmentSnapshot = {
  id: string
  product: string
  status: ShipmentStatus
  origin: string
  destination: string
  eta: string
}

type DayContext = {
  dateLabel: string
  shipments: ShipmentSnapshot[]
  stockAlerts: StockAlert[]
  counts: {
    activeShipments: number
    blockedOrders: number
    stockAlerts: number
  }
}

const DUST_API_KEY = process.env.DUST_API_KEY?.trim()
const DUST_WORKSPACE_ID = process.env.DUST_WORKSPACE_ID?.trim()

const ACTION_AGENT_MAP: Record<QuickActionId, string | undefined> = {
  resume_semaine: process.env.DUST_AGENT_RESUME_ID?.trim(),
  etat_stock: process.env.DUST_AGENT_STOCK_ID?.trim(),
  statut_commandes: process.env.DUST_AGENT_COMMANDES_ID?.trim(),
  quoi_faire: process.env.DUST_AGENT_JOURNEE_ID?.trim(),
}

const BRIEFING_AGENT_ID = process.env.DUST_AGENT_JOURNEE_ID?.trim()
const CHAT_AGENT_ID = process.env.DUST_AGENT_JOURNEE_ID?.trim()

const MOCK_STOCK_ALERTS: StockAlert[] = [
  { warehouse: 'EU Nord', product: 'Oak Tables', level: 'critical', quantity: 4, minQuantity: 12 },
  { warehouse: 'US Est', product: 'Dining Chairs', level: 'attention', quantity: 16, minQuantity: 20 },
  { warehouse: 'EU Sud', product: 'Birch Desks', level: 'ok', quantity: 31, minQuantity: 12 },
  { warehouse: 'UK Hub', product: 'Walnut Chairs', level: 'critical', quantity: 3, minQuantity: 10 },
]

function nowDateLabel() {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
}

function buildDayContext(): DayContext {
  const shipments: ShipmentSnapshot[] = mockShipments.map((shipment) => ({
    id: shipment.id,
    product: shipment.product,
    status: shipment.status,
    origin: shipment.origin.name,
    destination: shipment.destination.name,
    eta: shipment.eta,
  }))

  const blockedOrders = shipments.filter((shipment) => shipment.status === 'blocked').length
  const stockAlerts = MOCK_STOCK_ALERTS.filter((item) => item.level !== 'ok').length

  return {
    dateLabel: nowDateLabel(),
    shipments,
    stockAlerts: MOCK_STOCK_ALERTS,
    counts: {
      activeShipments: shipments.length,
      blockedOrders,
      stockAlerts,
    },
  }
}

function hasDustCredentials() {
  return Boolean(DUST_API_KEY && DUST_WORKSPACE_ID)
}

function mapStatusToLabel(status: ShipmentStatus) {
  if (status === 'blocked') return 'bloquee'
  if (status === 'in_transit') return 'en cours'
  if (status === 'rerouted') return 'reorientee'
  return 'ok'
}

function normalizeTagLevel(label: string): DayTag['level'] {
  const lowered = label.toLowerCase()
  if (lowered.includes('urgent') || lowered.includes('crit')) return 'urgent'
  if (lowered.includes('attention') || lowered.includes('warn')) return 'attention'
  return 'ok'
}

function normalizeStockLevel(level: string): StockAlertLevel {
  const lowered = level.toLowerCase()
  if (lowered.includes('crit') || lowered.includes('urgent')) return 'critical'
  if (lowered.includes('attention') || lowered.includes('warn')) return 'attention'
  return 'ok'
}

export function extractTextFromDustResponse(payload: unknown): string {
  if (!payload) return ''

  if (typeof payload === 'string') {
    return payload
  }

  if (Array.isArray(payload)) {
    return payload
      .map((part) => extractTextFromDustResponse(part))
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>

    const directKeys = ['text', 'content', 'answer', 'output', 'message']
    for (const key of directKeys) {
      const value = record[key]
      const text = extractTextFromDustResponse(value)
      if (text) return text
    }

    const nestedKeys = ['result', 'results', 'data', 'response', 'event', 'events']
    for (const key of nestedKeys) {
      const nested = record[key]
      const text = extractTextFromDustResponse(nested)
      if (text) return text
    }

    if (record.message && typeof record.message === 'object') {
      const text = extractTextFromDustResponse((record.message as Record<string, unknown>).content)
      if (text) return text
    }

    if (record.messages && Array.isArray(record.messages)) {
      const text = extractTextFromDustResponse(record.messages)
      if (text) return text
    }
  }

  return ''
}

function extractJsonFromText<T>(text: string): T | null {
  if (!text) return null

  try {
    return JSON.parse(text) as T
  } catch {
    // Continue.
  }

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as T
    } catch {
      // Continue.
    }
  }

  return null
}

function buildBriefingPrompt(context: DayContext) {
  return [
    'Tu aides un responsable operations.',
    `Date: ${context.dateLabel}`,
    `Commandes actives: ${context.counts.activeShipments}`,
    `Commandes bloquees: ${context.counts.blockedOrders}`,
    `Alertes stock: ${context.counts.stockAlerts}`,
    `Flux: ${context.shipments
      .slice(0, 8)
      .map((shipment) => `${shipment.id}:${mapStatusToLabel(shipment.status)}`)
      .join(', ')}`,
    `Stocks: ${context.stockAlerts
      .map((item) => `${item.warehouse}/${item.product}/${item.quantity}`)
      .join(', ')}`,
    'Genere UNE phrase courte (max 15 mots) sur l urgent du jour.',
    'Ajoute 2 ou 3 tags max 3 mots avec level urgent|attention|ok.',
    'Retourne uniquement du JSON: {"summary":"...","tags":[{"label":"...","level":"urgent"}]}.',
  ].join('\n')
}

function buildActionPrompt(actionId: QuickActionId, context: DayContext) {
  const contextBlob = JSON.stringify(
    {
      shipments: context.shipments,
      stockAlerts: context.stockAlerts,
      counts: context.counts,
    },
    null,
    2
  )

  if (actionId === 'resume_semaine') {
    return [
      'Genere un resume operationnel de la semaine en 4 a 5 points.',
      'Focus: volume, incidents, stock, points de vigilance.',
      'Pas de jargon technique.',
      'Format: une liste simple, lignes courtes.',
      `Donnees:\n${contextBlob}`,
    ].join('\n')
  }

  if (actionId === 'etat_stock') {
    return [
      'Analyse les stocks et liste les actions urgentes.',
      'Max 5 lignes.',
      'Chaque ligne: entrepot - produit - niveau - action recommandee.',
      `Donnees:\n${contextBlob}`,
    ].join('\n')
  }

  if (actionId === 'statut_commandes') {
    return [
      'Liste uniquement les commandes qui demandent une action humaine.',
      'Chaque ligne: ID - probleme court - action.',
      'Ignore les commandes qui vont bien.',
      'Si tout va bien: une phrase rassurante.',
      `Donnees:\n${contextBlob}`,
    ].join('\n')
  }

  return [
    'Donne une todo list pour la journee, triee par urgence.',
    'Max 5 items numerotes.',
    'Chaque item: action en 1 phrase + raison courte entre parentheses.',
    'Pas d intro, pas d outro.',
    `Donnees:\n${contextBlob}`,
  ].join('\n')
}

function buildSuggestionsPrompt(context: DayContext) {
  const dayContext = JSON.stringify(
    {
      blockedOrders: context.counts.blockedOrders,
      stockAlerts: context.counts.stockAlerts,
      highlights: context.shipments.slice(0, 6),
    },
    null,
    2
  )

  return [
    'Genere 4 questions courtes (max 8 mots).',
    'Ton conversationnel operationnel.',
    'Retour JSON uniquement: {"questions":["..."]}.',
    `Contexte:\n${dayContext}`,
  ].join('\n')
}

function buildChatPrompt(question: string, history: ChatMessage[], context: DayContext) {
  const compactHistory = history.slice(-6).map((message) => ({
    role: message.role,
    content: message.content,
  }))

  return [
    'Reponds de facon operationnelle, directe et courte.',
    'Pas de jargon technique.',
    `Question: ${question}`,
    `Historique: ${JSON.stringify(compactHistory)}`,
    `Contexte du jour: ${JSON.stringify(context.counts)}`,
    `Commandes sensibles: ${context.shipments
      .filter((shipment) => shipment.status !== 'on_track')
      .slice(0, 6)
      .map((shipment) => `${shipment.id}:${mapStatusToLabel(shipment.status)}`)
      .join(', ')}`,
  ].join('\n')
}

async function callDust(prompt: string, assistantId?: string) {
  if (!hasDustCredentials()) {
    throw new Error('Missing Dust credentials')
  }

  const response = await fetch(
    `https://dust.tt/api/v1/w/${DUST_WORKSPACE_ID}/assistant/conversations`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DUST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          content: prompt,
        },
        assistant_id: assistantId,
        blocking: true,
      }),
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    const details = await response.text()
    throw new Error(`Dust request failed (${response.status}): ${details}`)
  }

  const payload = await response.json()
  return extractTextFromDustResponse(payload)
}

function fallbackBriefing(context: DayContext): DayBriefingData {
  const tags: DayTag[] = []

  if (context.counts.blockedOrders > 0) {
    tags.push({ label: `${context.counts.blockedOrders} flux bloques`, level: 'urgent' })
  }

  if (context.counts.stockAlerts > 0) {
    tags.push({ label: `${context.counts.stockAlerts} alertes stock`, level: 'attention' })
  }

  tags.push({ label: `${context.counts.activeShipments} en cours`, level: 'ok' })

  return {
    dateLabel: context.dateLabel,
    summary:
      context.counts.blockedOrders > 0
        ? `${context.counts.blockedOrders} commandes demandent votre attention aujourd'hui.`
        : 'Aucune urgence critique detectee ce matin.',
    tags: tags.slice(0, 3),
    metrics: context.counts,
  }
}

function fallbackAction(actionId: QuickActionId, context: DayContext): string {
  if (actionId === 'resume_semaine') {
    return [
      '- Volume expedie stable sur la semaine.',
      `- ${context.counts.blockedOrders} flux ont demande un suivi manuel.`,
      `- ${context.counts.stockAlerts} alertes stock a surveiller.`,
      '- Les flux europeens restent globalement sous controle.',
      '- Priorite: traiter les blocages avant midi.',
    ].join('\n')
  }

  if (actionId === 'etat_stock') {
    const lines = context.stockAlerts
      .filter((item) => item.level !== 'ok')
      .slice(0, 5)
      .map((item) => {
        const level = item.level === 'critical' ? 'critique' : 'attention'
        return `${item.warehouse} - ${item.product} - ${level} - lancer un reapprovisionnement aujourd'hui.`
      })

    if (lines.length === 0) {
      return 'Tous les niveaux sont corrects aujourd hui.'
    }

    return lines.join('\n')
  }

  if (actionId === 'statut_commandes') {
    const lines = context.shipments
      .filter((shipment) => shipment.status === 'blocked' || shipment.status === 'rerouted')
      .slice(0, 5)
      .map((shipment) => {
        const issue = shipment.status === 'blocked' ? 'blocage transport' : 'itineraire modifie'
        return `${shipment.id} - ${issue} - confirmer le plan de reprise avec le transporteur.`
      })

    if (lines.length === 0) {
      return 'Les expeditions suivent le plan sans action urgente.'
    }

    return lines.join('\n')
  }

  const todos = [
    '1. Traiter les flux bloques en priorite (retard client).',
    '2. Lancer le reappro stock critique (eviter rupture).',
    '3. Confirmer les ETA a risque (prevenir equipe vente).',
    '4. Verifier les expeditions reroutees (risque cout).',
    '5. Faire un point de cloture a 17h (viser demain).',
  ]

  return todos.join('\n')
}

function fallbackSuggestions(context: DayContext): QuestionSuggestions {
  const hasBlocked = context.counts.blockedOrders > 0

  const questions = hasBlocked
    ? [
        'Pourquoi certaines commandes sont bloquees ?',
        'Quel est le point le plus urgent ?',
        'Mon stock tient combien de jours ?',
        'Que faut-il traiter avant midi ?',
        'Quelles expeditions risquent un retard ?',
      ]
    : [
        'Y a-t-il des risques aujourd hui ?',
        'Que verifier en premier ce matin ?',
        'Quels stocks surveiller cette semaine ?',
        'Quelles commandes sont sensibles ?',
        'Que prioriser cet apres-midi ?',
      ]

  return { questions }
}

function fallbackChat(message: string, context: DayContext): string {
  const lowered = message.toLowerCase()

  if (lowered.includes('stock')) {
    const risk = context.stockAlerts.filter((item) => item.level !== 'ok').length
    return risk > 0
      ? `Vous avez ${risk} alertes stock a traiter aujourd hui. Commencez par EU Nord et UK Hub.`
      : 'Pas d alerte stock critique detectee aujourd hui.'
  }

  if (lowered.includes('commande') || lowered.includes('expedition')) {
    return context.counts.blockedOrders > 0
      ? `${context.counts.blockedOrders} commandes sont bloquees. Priorite: valider un plan de contournement transport.`
      : 'Aucune commande bloquee. Les expeditions suivent le plan actuel.'
  }

  return 'Priorite du jour: traiter les blocages puis securiser les niveaux de stock critiques.'
}

export async function getDayBriefing(): Promise<DayBriefingData> {
  const context = buildDayContext()
  const fallback = fallbackBriefing(context)

  if (!hasDustCredentials()) {
    return fallback
  }

  try {
    const rawText = await callDust(buildBriefingPrompt(context), BRIEFING_AGENT_ID)
    const parsed = extractJsonFromText<{ summary?: string; tags?: Array<{ label?: string; level?: string }> }>(
      rawText
    )

    if (!parsed?.summary) {
      return fallback
    }

    const tags: DayTag[] = (parsed.tags || [])
      .map((tag) => ({
        label: (tag.label || '').trim(),
        level: normalizeTagLevel(tag.level || ''),
      }))
      .filter((tag) => tag.label)
      .slice(0, 3)

    return {
      dateLabel: context.dateLabel,
      summary: parsed.summary.trim(),
      tags: tags.length > 0 ? tags : fallback.tags,
      metrics: context.counts,
    }
  } catch (error) {
    console.error('Briefing fallback:', error)
    return fallback
  }
}

export async function runQuickAction(actionId: QuickActionId): Promise<string> {
  const context = buildDayContext()
  const fallback = fallbackAction(actionId, context)

  if (!hasDustCredentials()) {
    return fallback
  }

  try {
    const responseText = await callDust(buildActionPrompt(actionId, context), ACTION_AGENT_MAP[actionId])
    const normalized = responseText.trim()
    return normalized || fallback
  } catch (error) {
    console.error(`Action ${actionId} fallback:`, error)
    return fallback
  }
}

export async function getSuggestedQuestions(): Promise<QuestionSuggestions> {
  const context = buildDayContext()
  const fallback = fallbackSuggestions(context)

  if (!hasDustCredentials()) {
    return fallback
  }

  try {
    const rawText = await callDust(buildSuggestionsPrompt(context), CHAT_AGENT_ID)
    const parsed = extractJsonFromText<{ questions?: string[] }>(rawText)

    const questions = (parsed?.questions || [])
      .map((question) => question.trim())
      .filter(Boolean)
      .slice(0, 5)

    return questions.length > 0 ? { questions } : fallback
  } catch (error) {
    console.error('Suggestions fallback:', error)
    return fallback
  }
}

export async function askSmartQuestion(message: string, history: ChatMessage[] = []): Promise<string> {
  const context = buildDayContext()
  const fallback = fallbackChat(message, context)

  if (!hasDustCredentials()) {
    return fallback
  }

  try {
    const responseText = await callDust(buildChatPrompt(message, history, context), CHAT_AGENT_ID)
    const normalized = responseText.trim()
    return normalized || fallback
  } catch (error) {
    console.error('Chat fallback:', error)
    return fallback
  }
}

export function getStaticContextSnapshot() {
  return buildDayContext()
}

export function normalizeIncomingHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return []

  return history
    .filter((item) => typeof item === 'object' && item !== null)
    .map((item, index) => {
      const record = item as Record<string, unknown>
      const role: ChatMessage['role'] = record.role === 'assistant' ? 'assistant' : 'user'
      const content = typeof record.content === 'string' ? record.content.trim() : ''
      const createdAt =
        typeof record.createdAt === 'string' && record.createdAt
          ? record.createdAt
          : new Date(Date.now() - (history.length - index) * 1000).toISOString()

      return {
        id: typeof record.id === 'string' && record.id ? record.id : `msg-${index}`,
        role,
        content,
        createdAt,
      }
    })
    .filter((item) => item.content)
}

export function normalizeActionId(value: unknown): QuickActionId | null {
  if (typeof value !== 'string') return null

  if (
    value === 'resume_semaine' ||
    value === 'etat_stock' ||
    value === 'statut_commandes' ||
    value === 'quoi_faire'
  ) {
    return value
  }

  return null
}

export function normalizeQuestion(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, 1000)
}

export function normalizeTags(tags: unknown): DayTag[] {
  if (!Array.isArray(tags)) return []

  return tags
    .filter((item) => typeof item === 'object' && item !== null)
    .map((item) => {
      const record = item as Record<string, unknown>
      const label = typeof record.label === 'string' ? record.label.trim() : ''
      const level = normalizeTagLevel(typeof record.level === 'string' ? record.level : '')
      return { label, level }
    })
    .filter((tag) => tag.label)
    .slice(0, 3)
}

export function normalizeStockAlerts(items: unknown): StockAlert[] {
  if (!Array.isArray(items)) return []

  return items
    .filter((item) => typeof item === 'object' && item !== null)
    .map((item) => {
      const record = item as Record<string, unknown>
      return {
        warehouse: typeof record.warehouse === 'string' ? record.warehouse : 'N/A',
        product: typeof record.product === 'string' ? record.product : 'N/A',
        level: normalizeStockLevel(typeof record.level === 'string' ? record.level : 'attention'),
        quantity: typeof record.quantity === 'number' ? record.quantity : 0,
        minQuantity: typeof record.minQuantity === 'number' ? record.minQuantity : 0,
      }
    })
}
