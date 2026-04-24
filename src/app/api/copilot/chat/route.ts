import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { serializeJson } from '@/lib/copilot'
import {
  extractRecommendationIds,
  runLeiaToolCallingConversation,
  summarizeToolTrace,
  type LeiaChatMessage,
} from '@/lib/leia-chat'
import { checkRateLimit } from '@/lib/mira/rate-limit'
import { getOpenAISettingsForUser } from '@/lib/openai-settings'
import { prismaWithRetry } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

const chatSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(2).max(4000),
  language: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const sessionId = new URL(request.url).searchParams.get('sessionId')

    if (!sessionId) {
      const sessions = await prismaWithRetry((db) =>
        db.copilotChatSession.findMany({
          where: { user_id: userId },
          orderBy: { last_message_at: 'desc' },
          take: 10,
        })
      )

      return NextResponse.json({ sessions })
    }

    const session = await prismaWithRetry((db) =>
      db.copilotChatSession.findFirst({
        where: { id: sessionId, user_id: userId },
        include: {
          messages: {
            orderBy: { created_at: 'asc' },
          },
        },
      })
    )

    if (!session) {
      return NextResponse.json({ error: 'Chat session not found' }, { status: 404 })
    }

    return NextResponse.json({
      session: {
        ...session,
        messages: session.messages.map((message) => ({
          ...message,
          evidence_payload: serializeJson(message.evidence_payload),
        })),
      },
    })
  } catch (error) {
    console.error('Error loading chat data:', error)
    return NextResponse.json({ error: 'Failed to load chat data' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const rateLimit = checkRateLimit(`copilot-chat:${userId}`, {
      limit: 30,
      windowMs: 60_000,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many Leia chat requests. Try again in a moment.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const payload = chatSchema.parse(body)
    const origin = new URL(request.url).origin
    const { apiKey, model } = await getOpenAISettingsForUser(userId)

    if (!apiKey) {
      return NextResponse.json(
        { error: 'No OpenAI API key is configured on the server or merchant profile.' },
        { status: 500 }
      )
    }

    const session = payload.sessionId
      ? await prismaWithRetry((db) =>
          db.copilotChatSession.findFirst({
            where: { id: payload.sessionId, user_id: userId },
          })
        )
      : null

    const activeSession =
      session ||
      (await prismaWithRetry((db) =>
        db.copilotChatSession.create({
          data: {
            user_id: userId,
            title: payload.message.slice(0, 60),
          },
        })
      ))

    const previousMessages = await prismaWithRetry((db) =>
      db.copilotChatMessage.findMany({
        where: { session_id: activeSession.id },
        orderBy: { created_at: 'asc' },
        take: 20,
      })
    )

    const conversationMessages: LeiaChatMessage[] = previousMessages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      }))

    conversationMessages.push({
      role: 'user',
      content: payload.message,
    })

    await prismaWithRetry((db) =>
      db.copilotChatMessage.create({
        data: {
          session_id: activeSession.id,
          user_id: userId,
          role: 'user',
          content: payload.message,
        },
      })
    )

    const result = await runLeiaToolCallingConversation({
      apiKey,
      model,
      userId,
      origin,
      messages: conversationMessages,
      explicitLanguage: payload.language,
    })

    const recommendationIds = extractRecommendationIds(result.toolCallsTrace)
    const createdRecommendations = recommendationIds.length
      ? await prismaWithRetry((db) =>
          db.agentRecommendation.findMany({
            where: {
              user_id: userId,
              id: { in: recommendationIds },
            },
            orderBy: { created_at: 'desc' },
          })
        )
      : []

    const reasoningSummary =
      summarizeToolTrace(result.toolCallsTrace, result.language) || null

    const assistantMessage = await prismaWithRetry((db) =>
      db.copilotChatMessage.create({
        data: {
          session_id: activeSession.id,
          user_id: userId,
          role: 'assistant',
          content: result.message.content,
          reasoning_summary: reasoningSummary,
          evidence_payload: serializeJson(result.toolCallsTrace) as Prisma.InputJsonValue,
          linked_recommendation_id: createdRecommendations[0]?.id || null,
        },
      })
    )

    await Promise.all([
      prismaWithRetry((db) =>
        db.copilotChatSession.update({
          where: { id: activeSession.id },
          data: {
            last_message_at: new Date(),
            title:
              activeSession.title === 'New chat'
                ? payload.message.slice(0, 60)
                : activeSession.title,
          },
        })
      ),
      prismaWithRetry((db) =>
        db.agentContextSnapshot.create({
          data: {
            user_id: userId,
            scenario_type: createdRecommendations[0]?.scenario_type || 'leia_chat',
            label: payload.message.slice(0, 80),
            context_payload: serializeJson({
              language: result.language,
              tool_calls: result.toolCallsTrace,
            }) as Prisma.InputJsonValue,
          },
        })
      ),
    ])

    return NextResponse.json({
      sessionId: activeSession.id,
      message: {
        ...assistantMessage,
        evidence_payload: serializeJson(assistantMessage.evidence_payload),
      },
      recommendations: createdRecommendations.map((recommendation) => ({
        ...recommendation,
        evidence_payload: serializeJson(recommendation.evidence_payload),
        action_payload: serializeJson(recommendation.action_payload),
      })),
      fallback: false,
      model,
      language: result.language,
      tool_calls: result.toolCallsTrace,
    })
  } catch (error) {
    console.error('Error processing copilot chat:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message || 'Invalid request' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process chat request' },
      { status: 500 }
    )
  }
}
