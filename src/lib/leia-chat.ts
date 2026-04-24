import { MASCOT_TOOLS, executeTool } from '@/lib/mascot-tools'
import {
  buildLeiaSystemPrompt,
  buildPromptInjectionRefusal,
  looksLikePromptInjection,
  resolveConversationLanguage,
  type ConversationLanguage,
} from '@/lib/mira/conversation'

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

const TOOL_TRACE_LABEL: Record<ConversationLanguage, string> = {
  en: 'Tools used',
  fr: 'Outils utilises',
  it: 'Strumenti usati',
  de: 'Verwendete Tools',
  es: 'Herramientas usadas',
}

export function summarizeToolTrace(
  toolCalls: LeiaToolTrace[],
  language: ConversationLanguage
) {
  if (toolCalls.length === 0) return undefined

  const names = toolCalls.map((call) => call.name).join(', ')
  return `${TOOL_TRACE_LABEL[language]}: ${names}`
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

  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === 'user' && message.content?.trim())

  if (latestUserMessage?.content && looksLikePromptInjection(latestUserMessage.content)) {
    return {
      language,
      message: {
        role: 'assistant' as const,
        content: buildPromptInjectionRefusal(language),
      },
      toolCallsTrace: [] as LeiaToolTrace[],
    }
  }

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
