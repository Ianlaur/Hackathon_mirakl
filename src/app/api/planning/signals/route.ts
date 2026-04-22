import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { serializeJson } from '@/lib/copilot'

const signalSchema = z.object({
  title: z.string().min(2).max(160),
  summary: z.string().min(10).max(2500),
  sourceName: z.string().max(120).optional(),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  signalType: z.string().min(2).max(50),
  impactLevel: z.string().min(3).max(20).optional(),
  relevanceScore: z.number().int().min(0).max(100),
  geography: z.string().max(120).optional(),
  tags: z.array(z.string().max(50)).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
})

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const signals = await prisma.externalContextSignal.findMany({
      where: { user_id: userId },
      include: {
        recommendation: true,
      },
      orderBy: [{ relevance_score: 'desc' }, { created_at: 'desc' }],
      take: 25,
    })

    return NextResponse.json({
      signals: signals.map((signal) => ({
        ...signal,
        evidence_payload: serializeJson(signal.evidence_payload),
      })),
    })
  } catch (error) {
    console.error('Error loading context signals:', error)
    return NextResponse.json({ error: 'Failed to load context signals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    const payload = signalSchema.parse(body)

    let recommendation = null
    if (payload.relevanceScore >= 70 && ['medium', 'high', 'critical'].includes(payload.impactLevel || 'medium')) {
      recommendation = await prisma.agentRecommendation.create({
        data: {
          user_id: userId,
          title: `Assess event impact: ${payload.title}`,
          scenario_type: 'demand_event',
          reasoning_summary:
            'A high-relevance external context signal matched the merchant planning profile and should be reviewed.',
          evidence_payload: serializeJson([
            { label: 'Signal type', value: payload.signalType },
            { label: 'Impact', value: payload.impactLevel || 'medium' },
            { label: 'Relevance score', value: `${payload.relevanceScore}` },
          ]) as Prisma.InputJsonValue,
          expected_impact: 'Prepare stock or supply decisions before the event affects the business.',
          confidence_note: 'Medium confidence driven by rule-based relevance matching.',
          approval_required: true,
          action_payload: serializeJson({
            target: 'demand_event_review',
            payload,
          }) as Prisma.InputJsonValue,
          source: 'n8n_signal',
        },
      })
    }

    const signal = await prisma.externalContextSignal.create({
      data: {
        user_id: userId,
        recommendation_id: recommendation?.id || null,
        title: payload.title,
        summary: payload.summary,
        source_name: payload.sourceName || null,
        source_url: payload.sourceUrl || null,
        signal_type: payload.signalType,
        impact_level: payload.impactLevel || 'medium',
        relevance_score: payload.relevanceScore,
        geography: payload.geography || null,
        tags: payload.tags || [],
        starts_at: payload.startsAt ? new Date(payload.startsAt) : null,
        ends_at: payload.endsAt ? new Date(payload.endsAt) : null,
        evidence_payload: serializeJson(payload) as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ signal, recommendation }, { status: 201 })
  } catch (error) {
    console.error('Error creating context signal:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || 'Invalid signal payload' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Failed to create context signal' }, { status: 500 })
  }
}
