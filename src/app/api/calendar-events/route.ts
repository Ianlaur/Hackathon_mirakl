import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { hasDatabaseUrl, isDatabaseConfigError, prisma } from '@/lib/prisma'
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
    if (!hasDatabaseUrl()) {
      return NextResponse.json([])
    }

    const userId = await getCurrentUserId()
    const events = await prisma.$queryRaw<DbCalendarEvent[]>`
      SELECT id::text, title, start_at, end_at, kind, impact, zone, notes, locked
      FROM public.calendar_events
      WHERE user_id = ${userId}::uuid
      ORDER BY start_at ASC, title ASC
    `

    return NextResponse.json(events.map(serializeEvent))
  } catch (error) {
    if (isDatabaseConfigError(error)) {
      return NextResponse.json([])
    }

    console.error('Error fetching calendar events:', error)
    return NextResponse.json({ error: 'Impossible de récupérer les événements' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  let parsedData: z.infer<typeof eventSchema> | null = null

  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    const data = eventSchema.parse(body)
    parsedData = data
    const startDate = data.startDate
    const endDate = data.endDate >= startDate ? data.endDate : startDate

    if (!hasDatabaseUrl()) {
      return NextResponse.json(
        {
          id: `local-${Date.now()}`,
          title: data.title,
          startDate,
          endDate,
          startTime: data.startTime,
          endTime: data.endTime,
          kind: data.kind,
          impact: data.impact,
          zone: data.zone || '',
          notes: data.notes || '',
          locked: data.locked || false,
        },
        { status: 201 }
      )
    }

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

    const createdEvent = events[0]

    if (createdEvent.kind === 'leave') {
      notifyN8n({
        event_id: createdEvent.id,
        user_id: userId,
        kind: createdEvent.kind,
        title: createdEvent.title,
        start_at: createdEvent.start_at.toISOString(),
        end_at: createdEvent.end_at.toISOString(),
      }).catch((err) => {
        console.error('n8n notify failed (non-blocking):', err)
      })
    }

    return NextResponse.json(serializeEvent(createdEvent), { status: 201 })
  } catch (error) {
    console.error('Error creating calendar event:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    if (isDatabaseConfigError(error) && parsedData) {
      const startDate = parsedData.startDate
      const endDate = parsedData.endDate >= startDate ? parsedData.endDate : startDate
      return NextResponse.json(
        {
          id: `local-${Date.now()}`,
          title: parsedData.title,
          startDate,
          endDate,
          startTime: parsedData.startTime,
          endTime: parsedData.endTime,
          kind: parsedData.kind,
          impact: parsedData.impact,
          zone: parsedData.zone || '',
          notes: parsedData.notes || '',
          locked: parsedData.locked || false,
        },
        { status: 201 }
      )
    }

    return NextResponse.json({ error: 'Impossible de créer l’événement' }, { status: 500 })
  }
}

async function notifyN8n(payload: Record<string, unknown>) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL
  if (!webhookUrl) return

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}
