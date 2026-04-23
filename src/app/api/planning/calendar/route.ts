import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { serializeJson } from '@/lib/serialize'

const eventSchema = z.object({
  title: z.string().min(2).max(120),
  eventType: z.string().min(2).max(50),
  startDate: z.string(),
  endDate: z.string(),
  notes: z.string().max(1500).optional(),
  impactLevel: z.string().min(3).max(20).optional(),
})

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const events = await prisma.merchantCalendarEvent.findMany({
      where: { user_id: userId },
      orderBy: { start_date: 'asc' },
      take: 25,
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Error loading calendar events:', error)
    return NextResponse.json({ error: 'Failed to load calendar events' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    const payload = eventSchema.parse(body)

    const event = await prisma.merchantCalendarEvent.create({
      data: {
        user_id: userId,
        title: payload.title,
        event_type: payload.eventType,
        start_date: new Date(payload.startDate),
        end_date: new Date(payload.endDate),
        notes: payload.notes || null,
        impact_level: payload.impactLevel || 'medium',
      },
    })

    let recommendation = null
    if (['vacation', 'absence', 'blackout'].includes(payload.eventType)) {
      recommendation = await prisma.agentRecommendation.create({
        data: {
          user_id: userId,
          title: `Prepare operations for ${payload.title}`,
          scenario_type: 'calendar_absence',
          reasoning_summary:
            'A business availability event was added to the calendar and may affect manual stock and transport operations.',
          evidence_payload: serializeJson([
            { label: 'Event', value: payload.title },
            { label: 'Dates', value: `${payload.startDate} -> ${payload.endDate}` },
            { label: 'Impact', value: payload.impactLevel || 'medium' },
          ]) as Prisma.InputJsonValue,
          expected_impact: 'Create a buffer for absence periods and avoid preventable penalties.',
          confidence_note: 'Medium confidence based on the merchant calendar.',
          approval_required: true,
          action_payload: serializeJson({
            target: 'calendar_absence_plan',
            payload,
          }) as Prisma.InputJsonValue,
          source: 'calendar',
        },
      })
    }

    return NextResponse.json({ event, recommendation }, { status: 201 })
  } catch (error) {
    console.error('Error creating calendar event:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || 'Invalid event payload' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 })
  }
}
