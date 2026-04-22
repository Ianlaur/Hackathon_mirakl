import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { generateCopilotResponse, serializeJson } from '@/lib/copilot'

const chatSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(2).max(4000),
})

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const sessionId = new URL(request.url).searchParams.get('sessionId')

    if (!sessionId) {
      const sessions = await prisma.copilotChatSession.findMany({
        where: { user_id: userId },
        orderBy: { last_message_at: 'desc' },
        take: 10,
      })

      return NextResponse.json({ sessions })
    }

    const session = await prisma.copilotChatSession.findFirst({
      where: { id: sessionId, user_id: userId },
      include: {
        messages: {
          orderBy: { created_at: 'asc' },
        },
      },
    })

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
    const body = await request.json()
    const payload = chatSchema.parse(body)

    const session =
      payload.sessionId
        ? await prisma.copilotChatSession.findFirst({
            where: { id: payload.sessionId, user_id: userId },
          })
        : null

    const activeSession =
      session ||
      (await prisma.copilotChatSession.create({
        data: {
          user_id: userId,
          title: payload.message.slice(0, 60),
        },
      }))

    await prisma.copilotChatMessage.create({
      data: {
        session_id: activeSession.id,
        user_id: userId,
        role: 'user',
        content: payload.message,
      },
    })

    const result = await generateCopilotResponse(userId, payload.message)

    const createdRecommendations = []
    for (const suggestion of result.recommendations) {
      const recommendation = await prisma.agentRecommendation.create({
        data: {
          user_id: userId,
          title: suggestion.title,
          scenario_type: suggestion.scenarioType,
          reasoning_summary: suggestion.reasoningSummary,
          evidence_payload: serializeJson(result.evidence) as Prisma.InputJsonValue,
          expected_impact: suggestion.expectedImpact,
          confidence_note: suggestion.confidenceNote,
          approval_required: true,
          action_payload: serializeJson({
            target: suggestion.target,
            payload: serializeJson(suggestion.payload || {}),
            requestedFromChat: true,
          }) as Prisma.InputJsonValue,
          source: result.fallback ? 'copilot_fallback' : 'copilot',
        },
      })

      createdRecommendations.push(recommendation)
    }

    const assistantMessage = await prisma.copilotChatMessage.create({
      data: {
        session_id: activeSession.id,
        user_id: userId,
        role: 'assistant',
        content: result.answer,
        reasoning_summary: result.reasoningSummary,
        evidence_payload: serializeJson(result.evidence) as Prisma.InputJsonValue,
        linked_recommendation_id: createdRecommendations[0]?.id || null,
      },
    })

    await Promise.all([
      prisma.copilotChatSession.update({
        where: { id: activeSession.id },
        data: {
          last_message_at: new Date(),
          title: activeSession.title === 'New chat' ? payload.message.slice(0, 60) : activeSession.title,
        },
      }),
      prisma.agentContextSnapshot.create({
        data: {
          user_id: userId,
          scenario_type: createdRecommendations[0]?.scenario_type || 'chat',
          label: payload.message.slice(0, 80),
          context_payload: serializeJson(result.context) as Prisma.InputJsonValue,
        },
      }),
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
      fallback: result.fallback,
      model: result.usedModel,
    })
  } catch (error) {
    console.error('Error processing copilot chat:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || 'Invalid request' }, { status: 400 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process chat request' },
      { status: 500 }
    )
  }
}
