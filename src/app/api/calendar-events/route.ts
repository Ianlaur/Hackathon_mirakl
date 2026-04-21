import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

const eventKinds = ['commerce', 'holiday', 'leave', 'logistics', 'marketing', 'internal'] as const
const eventImpacts = ['low', 'medium', 'high', 'critical'] as const

type DbCalendarEvent = {
  id: string
  title: string
  start_at: Date
  end_at: Date
  kind: string
  impact: string
  zone: string | null
  notes: string | null
  locked: boolean
}

const eventSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(140),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^$|^\d{2}:\d{2}$/).default(''),
  endTime: z.string().regex(/^$|^\d{2}:\d{2}$/).default(''),
  kind: z.enum(eventKinds),
  impact: z.enum(eventImpacts),
  zone: z.string().max(120).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  locked: z.boolean().optional(),
})

function toTimestamp(date: string, time: string, fallbackTime: string) {
  return new Date(`${date}T${time || fallbackTime}:00.000Z`)
}

function serializeEvent(event: DbCalendarEvent) {
  return {
    id: event.id,
    title: event.title,
    startDate: event.start_at.toISOString().slice(0, 10),
    endDate: event.end_at.toISOString().slice(0, 10),
    startTime: event.start_at.toISOString().slice(11, 16) === '12:00' ? '' : event.start_at.toISOString().slice(11, 16),
    endTime: event.end_at.toISOString().slice(11, 16) === '12:00' ? '' : event.end_at.toISOString().slice(11, 16),
    kind: event.kind,
    impact: event.impact,
    zone: event.zone || '',
    notes: event.notes || '',
    locked: event.locked,
  }
}

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const events = await prisma.$queryRaw<DbCalendarEvent[]>`
      SELECT id::text, title, start_at, end_at, kind, impact, zone, notes, locked
      FROM public.calendar_events
      WHERE user_id = ${userId}::uuid
      ORDER BY start_at ASC, title ASC
    `

    return NextResponse.json(events.map(serializeEvent))
  } catch (error) {
    console.error('Error fetching calendar events:', error)
    return NextResponse.json({ error: 'Impossible de récupérer les événements' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    const data = eventSchema.parse(body)
    const startDate = data.startDate
    const endDate = data.endDate >= startDate ? data.endDate : startDate

    const events = await prisma.$queryRaw<DbCalendarEvent[]>`
      INSERT INTO public.calendar_events (
        user_id, title, start_at, end_at, kind, impact, zone, notes, locked
      )
      VALUES (
        ${userId}::uuid,
        ${data.title},
        ${toTimestamp(startDate, data.startTime, '12:00')},
        ${toTimestamp(endDate, data.endTime, data.endTime || data.startTime ? data.endTime || data.startTime : '12:00')},
        ${data.kind},
        ${data.impact},
        ${data.zone || null},
        ${data.notes || null},
        ${data.locked || false}
      )
      RETURNING id::text, title, start_at, end_at, kind, impact, zone, notes, locked
    `

    return NextResponse.json(serializeEvent(events[0]), { status: 201 })
  } catch (error) {
    console.error('Error creating calendar event:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Impossible de créer l’événement' }, { status: 500 })
  }
}
