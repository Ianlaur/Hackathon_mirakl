export type DayTagLevel = 'urgent' | 'attention' | 'ok'

export interface DayTag {
  label: string
  level: DayTagLevel
}

export interface DayMetrics {
  activeShipments: number
  blockedOrders: number
  stockAlerts: number
}

export interface DayBriefingData {
  dateLabel: string
  summary: string
  tags: DayTag[]
  metrics: DayMetrics
}

export type QuickActionId =
  | 'weekly_summary'
  | 'stock_status'
  | 'order_status'
  | 'next_steps'

export type CardState = 'idle' | 'loading' | 'result' | 'error'

export interface ActionCardConfig {
  id: QuickActionId
  label: string
  description: string
  cta: string
  icon: string
  accentColor: string
  loadingLabel: string
  highlight?: boolean
  badgeCount?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface QuestionSuggestions {
  questions: string[]
}

export interface QuickActionPayload {
  actionId: QuickActionId
}

export interface ChatRequestPayload {
  message: string
  history?: ChatMessage[]
}

export interface SuggestionRequestPayload {
  kind: 'suggestions'
}
