import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOpenAISettingsForUser } from '@/lib/openai-settings'
import { checkRateLimit } from '@/lib/leia/rate-limit'
import { getCurrentUserId } from '@/lib/session'
import {
  type LeiaChatMessage,
  runLeiaToolCallingConversation,
  summarizeToolTrace,
} from '@/lib/leia-chat'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().nullable().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal('function'),
        function: z.object({ name: z.string(), arguments: z.string() }),
      })
    )
    .optional(),
  name: z.string().optional(),
})

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1),
  language: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const rateLimit = checkRateLimit(`mascot-chat:${userId}`, {
      limit: 30,
      windowMs: 60_000,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many Leia chat requests. Try again in a moment.' },
        { status: 429 }
      )
    }

    const { apiKey, model } = await getOpenAISettingsForUser(userId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No OpenAI API key is configured on the server or merchant profile.' },
        { status: 500 }
      )
    }

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const origin = new URL(request.url).origin
    const result = await runLeiaToolCallingConversation({
      apiKey,
      model,
      userId,
      origin,
      messages: parsed.data.messages as LeiaChatMessage[],
      explicitLanguage: parsed.data.language,
    })

    return NextResponse.json({
      message: {
        ...result.message,
        reasoning_summary: summarizeToolTrace(result.toolCallsTrace, result.language),
      },
      tool_calls: result.toolCallsTrace,
      language: result.language,
      model,
    })
  } catch (error) {
    console.error('mascot chat error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
