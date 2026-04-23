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
  title: z.string().min(1, 'Le titre est requis').max(140).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^$|^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^$|^\d{2}:\d{2}$/).optional(),
  kind: z.enum(eventKinds).optional(),
  impact: z.enum(eventImpacts).optional(),
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

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  let parsedData: z.infer<typeof eventSchema> | null = null

  try {
    const body = await request.json()
    const data = eventSchema.parse(body)
    parsedData = data
    const userId = await getCurrentUserId()

    if (!hasDatabaseUrl()) {
      const startDate = data.startDate || new Date().toISOString().slice(0, 10)
      const endDate = data.endDate || startDate
      return NextResponse.json({
        id: params.id,
        title: data.title || 'Événement',
        startDate,
        endDate: endDate >= startDate ? endDate : startDate,
        startTime: data.startTime || '',
        endTime: data.endTime || '',
        kind: data.kind || 'internal',
        impact: data.impact || 'medium',
        zone: data.zone || '',
        notes: data.notes || '',
        locked: data.locked || false,
      })
    }

    const existingRows = await prisma.$queryRaw<DbCalendarEvent[]>`
      SELECT id::text, title, start_at, end_at, kind, impact, zone, notes, locked
      FROM public.calendar_events
      WHERE id = ${params.id}::uuid AND user_id = ${userId}::uuid
      LIMIT 1
    `
    const existing = existingRows[0]

    if (!existing) {
      return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 })
    }

    const nextStartDate = data.startDate || existing.start_at.toISOString().slice(0, 10)
    const requestedEndDate = data.endDate || existing.end_at.toISOString().slice(0, 10)
    const nextEndDate = requestedEndDate >= nextStartDate ? requestedEndDate : nextStartDate
    const existingStartTime = existing.start_at.toISOString().slice(11, 16)
    const existingEndTime = existing.end_at.toISOString().slice(11, 16)
    const nextStartTime = data.startTime ?? (existingStartTime === '12:00' ? '' : existingStartTime)
    const nextEndTime = data.endTime ?? (existingEndTime === '12:00' ? '' : existingEndTime)

    const events = await prisma.$queryRaw<DbCalendarEvent[]>`
      UPDATE public.calendar_events
      SET
        title = ${data.title ?? existing.title},
        start_at = ${toTimestamp(nextStartDate, nextStartTime, '12:00')},
        end_at = ${toTimestamp(nextEndDate, nextEndTime, nextEndTime || nextStartTime ? nextEndTime || nextStartTime : '12:00')},
        kind = ${data.kind ?? existing.kind},
        impact = ${data.impact ?? existing.impact},
        zone = ${data.zone !== undefined ? data.zone || null : existing.zone},
        notes = ${data.notes !== undefined ? data.notes || null : existing.notes},
        locked = ${data.locked ?? existing.locked},
        updated_at = now()
      WHERE id = ${params.id}::uuid AND user_id = ${userId}::uuid
      RETURNING id::text, title, start_at, end_at, kind, impact, zone, notes, locked
    `

    return NextResponse.json(serializeEvent(events[0]))
  } catch (error) {
    console.error('Error updating calendar event:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    if (isDatabaseConfigError(error) && parsedData) {
      const startDate = parsedData.startDate || new Date().toISOString().slice(0, 10)
      const endDate = parsedData.endDate || startDate
      return NextResponse.json({
        id: params.id,
        title: parsedData.title || 'Événement',
        startDate,
        endDate: endDate >= startDate ? endDate : startDate,
        startTime: parsedData.startTime || '',
        endTime: parsedData.endTime || '',
        kind: parsedData.kind || 'internal',
        impact: parsedData.impact || 'medium',
        zone: parsedData.zone || '',
        notes: parsedData.notes || '',
        locked: parsedData.locked || false,
      })
    }

    return NextResponse.json({ error: 'Impossible de mettre à jour l’événement' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!hasDatabaseUrl()) {
      return NextResponse.json({ success: true, id: params.id })
    }

    const userId = await getCurrentUserId()
    const existing = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id::text
      FROM public.calendar_events
      WHERE id = ${params.id}::uuid AND user_id = ${userId}::uuid
      LIMIT 1
    `

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Événement introuvable' }, { status: 404 })
    }

    await prisma.$executeRaw`
      DELETE FROM public.calendar_events
      WHERE id = ${params.id}::uuid AND user_id = ${userId}::uuid
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isDatabaseConfigError(error)) {
      return NextResponse.json({ success: true, id: params.id })
    }

    console.error('Error deleting calendar event:', error)
    return NextResponse.json({ error: 'Impossible de supprimer l’événement' }, { status: 500 })
  }
}
