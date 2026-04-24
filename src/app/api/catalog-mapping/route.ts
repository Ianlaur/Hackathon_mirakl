import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { analyzeCatalogCsv } from '@/lib/catalog-mapping'
import {
  createCatalogReviewRecords,
  listCatalogReviewRecords,
} from '@/lib/catalog-review-records'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  file_name: z.string().trim().min(1).default('catalog.csv'),
  csv: z.string().min(1),
  channel: z.string().trim().min(1).optional(),
})

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const records = await listCatalogReviewRecords(userId)
    return NextResponse.json({ records })
  } catch (error) {
    console.error('catalog mapping GET error:', error)
    return NextResponse.json({ error: 'Failed to load catalog mappings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const payload = createSchema.parse(await request.json())
    const proposals = analyzeCatalogCsv({
      fileName: payload.file_name,
      csv: payload.csv,
    })

    if (proposals.length === 0) {
      return NextResponse.json({ error: 'No catalog rows found in file' }, { status: 400 })
    }

    const records = await createCatalogReviewRecords({
      userId,
      channel: payload.channel ?? 'mirakl',
      proposals,
    })

    return NextResponse.json({
      records,
      analysis_model: 'gpt-5.4-mini',
      analysis_source: 'deterministic_catalog_review',
      simulated_push: true,
    })
  } catch (error) {
    console.error('catalog mapping POST error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? 'Invalid payload' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to analyze catalog' }, { status: 500 })
  }
}
