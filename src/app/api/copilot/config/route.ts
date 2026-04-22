import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/session'
import { getCopilotConfig, upsertCopilotConfig } from '@/lib/copilot'
import { encryptSecret, maskSecret } from '@/lib/crypto'

const configSchema = z.object({
  apiKey: z.string().optional(),
  preferredModel: z.string().min(3).max(100).optional(),
  autonomyMode: z.string().min(3).max(50).optional(),
  merchantCategory: z.string().max(100).optional(),
  operatingRegions: z.string().max(500).optional(),
  supplierRegions: z.string().max(500).optional(),
  supplierNames: z.string().max(500).optional(),
  seasonalityTags: z.string().max(500).optional(),
  protectedChannels: z.string().max(500).optional(),
  watchlistKeywords: z.string().max(500).optional(),
  planningNotes: z.string().max(2000).optional(),
})

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const config = await getCopilotConfig(userId)
    return NextResponse.json(config)
  } catch (error) {
    console.error('Error fetching copilot config:', error)
    return NextResponse.json({ error: 'Failed to load copilot settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    const payload = configSchema.parse(body)

    await upsertCopilotConfig(userId, payload, {
      encryptSecretValue: encryptSecret,
      maskSecretValue: maskSecret,
    })

    const config = await getCopilotConfig(userId)
    return NextResponse.json(config)
  } catch (error) {
    console.error('Error updating copilot config:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message || 'Invalid payload' }, { status: 400 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update copilot settings' },
      { status: 500 }
    )
  }
}
