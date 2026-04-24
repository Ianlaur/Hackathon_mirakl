import { MASCOT_TOOLS, executeTool } from '@/lib/mascot-tools'

export type ConversationLanguage = 'fr' | 'en'

export type LeiaChatMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content?: string | null
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  name?: string
}

export type LeiaToolTrace = {
  name: string
  args: Record<string, unknown>
  result: unknown
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function normalizeConversationLanguage(
  value: string | null | undefined
): ConversationLanguage | null {
  const normalized = String(value || '').trim().toLowerCase()

  if (!normalized) return null
  if (normalized === 'fr' || normalized.startsWith('fr-') || normalized === 'french') return 'fr'
  if (normalized === 'en' || normalized.startsWith('en-') || normalized === 'english') return 'en'

  return null
}

export function detectConversationLanguage(text: string): ConversationLanguage {
  const normalized = normalizeText(text)

  if (!normalized.trim()) return 'fr'

  const frenchHints = [
    ' quel ',
    ' quelle ',
    ' quels ',
    ' quelles ',
    ' quoi ',
    ' comment ',
    ' pourquoi ',
    " aujourd'hui ",
    ' mon ',
    ' ma ',
    ' mes ',
    ' je ',
    ' j ',
    ' bonjour ',
    ' merci ',
    ' stock ',
    ' commande ',
    ' commandes ',
    ' conges ',
    ' fournisseur ',
    ' fournisseurs ',
    ' peux tu ',
    ' peux-tu ',
  ]

  const englishHints = [
    ' what ',
    ' how ',
    ' why ',
    ' today ',
    ' my ',
    ' hello ',
    ' thanks ',
    ' stock ',
    ' order ',
    ' orders ',
    ' supplier ',
    ' suppliers ',
    ' can you ',
    ' please ',
  ]

  const padded = ` ${normalized} `
  let frenchScore = /[àâçéèêëîïôùûüÿœ]/i.test(text) ? 2 : 0
  let englishScore = 0

  for (const hint of frenchHints) {
    if (padded.includes(hint)) frenchScore += 1
  }

  for (const hint of englishHints) {
    if (padded.includes(hint)) englishScore += 1
  }

  if (frenchScore > englishScore) return 'fr'
  if (englishScore > frenchScore) return 'en'

  return /\b(the|what|how|can|could|please|today|order|orders)\b/i.test(text) ? 'en' : 'fr'
}

export function resolveConversationLanguage(args: {
  explicitLanguage?: string | null
  messages: LeiaChatMessage[]
}): ConversationLanguage {
  const explicit = normalizeConversationLanguage(args.explicitLanguage)
  if (explicit) return explicit

  for (let index = args.messages.length - 1; index >= 0; index -= 1) {
    const message = args.messages[index]
    if (message.role !== 'user' || !message.content) continue
    return detectConversationLanguage(message.content)
  }

  return 'fr'
}

export function buildLeiaSystemPrompt({
  language,
}: {
  language: ConversationLanguage
}) {
  if (language === 'fr') {
    return [
      'Tu es LEIA.',
      'Tu aides Marie à piloter les opérations quotidiennes de Nordika Studio.',
      'Réponds en français.',
      'Style: factuel, calme, direct, sans emoji.',
      'N invente jamais un chiffre. Utilise les tools dès qu une donnée est nécessaire.',
      'Pour un congé ou une absence, ne crée jamais l événement directement: propose les dates, demande une validation explicite, puis appelle create_calendar_event avec confirmed=true seulement après un oui clair.',
      'Quand une action est effectuée ou préparée, indique toujours comment la retrouver ou l annuler depuis Actions.',
      'Si la demande est ambiguë, pose une seule question de clarification.',
      'Reste concise, sauf si un tableau ou une liste apporte plus de clarté.',
    ].join(' ')
  }

  return [
    'You are LEIA.',
    'You help Marie run the daily operations of Nordika Studio.',
    'Respond in English.',
    'Style: factual, calm, direct, no emoji.',
    'Never invent a number. Use tools whenever data is needed.',
    'For leave or vacation requests, never create the event immediately: propose the dates, ask for explicit confirmation, then call create_calendar_event with confirmed=true only after a clear yes.',
    'When an action is completed or prepared, always explain how to find it or undo it from Actions.',
    'If the request is ambiguous, ask one clarifying question.',
    'Stay concise unless a table or list adds clarity.',
  ].join(' ')
}

export function summarizeToolTrace(
  toolCalls: LeiaToolTrace[],
  language: ConversationLanguage
) {
  if (toolCalls.length === 0) return undefined

  const names = toolCalls.map((call) => call.name).join(', ')
  return language === 'fr' ? `Outils utilisés : ${names}` : `Tools used: ${names}`
}

export function extractRecommendationIds(toolCalls: LeiaToolTrace[]) {
  const ids = new Set<string>()

  for (const call of toolCalls) {
    if (!call.result || typeof call.result !== 'object') continue

    const result = call.result as Record<string, unknown>
    if (typeof result.recommendation_id === 'string' && result.recommendation_id) {
      ids.add(result.recommendation_id)
    }
  }

  return Array.from(ids)
}

async function callOpenAI({
  messages,
  apiKey,
  model,
}: {
  messages: LeiaChatMessage[]
  apiKey: string
  model: string
}) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      messages,
      tools: MASCOT_TOOLS,
      parallel_tool_calls: true,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`)
  }

  return response.json()
}

export async function runLeiaToolCallingConversation({
  apiKey,
  model,
  userId,
  origin,
  messages,
  explicitLanguage,
}: {
  apiKey: string
  model?: string | null
  userId: string
  origin: string
  messages: LeiaChatMessage[]
  explicitLanguage?: string | null
}) {
  const language = resolveConversationLanguage({
    explicitLanguage,
    messages,
  })
  const systemPrompt = buildLeiaSystemPrompt({ language })
  const today = new Date().toISOString().slice(0, 10)
  const workingMessages: LeiaChatMessage[] = [
    {
      role: 'system',
      content: `${systemPrompt} Today: ${today}.`,
    },
    ...messages,
  ]
  const toolCallsTrace: LeiaToolTrace[] = []

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const completion = await callOpenAI({
      messages: workingMessages,
      apiKey,
      model: model?.trim() || 'gpt-5.4-mini',
    })

    const choice = completion.choices?.[0]
    if (!choice?.message) {
      throw new Error('No completion returned by OpenAI')
    }

    const assistantMessage = choice.message as LeiaChatMessage

    if (assistantMessage.tool_calls?.length) {
      workingMessages.push({
        role: 'assistant',
        content: assistantMessage.content ?? '',
        tool_calls: assistantMessage.tool_calls,
      })

      for (const call of assistantMessage.tool_calls) {
        let parsedArgs: Record<string, unknown> = {}

        try {
          parsedArgs = JSON.parse(call.function.arguments || '{}')
        } catch {
          parsedArgs = {}
        }

        const result = await executeTool(call.function.name, parsedArgs, {
          userId,
          origin,
        })

        toolCallsTrace.push({
          name: call.function.name,
          args: parsedArgs,
          result,
        })

        workingMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: call.function.name,
          content: JSON.stringify(result),
        })
      }

      continue
    }

    return {
      language,
      message: {
        role: 'assistant' as const,
        content: assistantMessage.content ?? '',
      },
      toolCallsTrace,
    }
  }

  throw new Error('Too many tool-calling iterations')
}
