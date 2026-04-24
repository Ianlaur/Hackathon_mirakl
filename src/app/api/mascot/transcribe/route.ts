import { NextRequest, NextResponse } from 'next/server'
import { getOpenAISettingsForUser } from '@/lib/openai-settings'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const WHISPER_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions'
const DEFAULT_MODEL = 'whisper-1'
const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB OpenAI limit

function normalizeLanguage(value: string | null | undefined) {
  const normalized = String(value || '').trim().toLowerCase()

  if (!normalized) return null
  if (normalized === 'fr' || normalized.startsWith('fr-') || normalized === 'french') return 'fr'
  if (normalized === 'en' || normalized.startsWith('en-') || normalized === 'english') return 'en'
  if (normalized === 'it' || normalized.startsWith('it-') || normalized === 'italian') return 'it'
  if (normalized === 'de' || normalized.startsWith('de-') || normalized === 'german') return 'de'
  if (
    normalized === 'es' ||
    normalized.startsWith('es-') ||
    normalized === 'spanish' ||
    normalized === 'espanol' ||
    normalized === 'español'
  ) {
    return 'es'
  }

  return normalized
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const { apiKey } = await getOpenAISettingsForUser(userId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No OpenAI API key is configured on the server or merchant profile.' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Champ 'file' manquant ou invalide." },
        { status: 400 }
      )
    }
    if (file.size === 0) {
      return NextResponse.json({ error: 'Fichier audio vide.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Fichier audio trop volumineux (max 25 MB).' },
        { status: 413 }
      )
    }

    const model = (formData.get('model') as string | null) || DEFAULT_MODEL

    const upstream = new FormData()
    upstream.append('file', file, file.name || 'audio.webm')
    upstream.append('model', model)
    upstream.append('response_format', 'verbose_json')

    const response = await fetch(WHISPER_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: upstream,
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Whisper error:', response.status, errText)
      return NextResponse.json(
        { error: `OpenAI Whisper a renvoyé ${response.status}` },
        { status: 502 }
      )
    }

    const data = (await response.json()) as { text?: string; language?: string }
    return NextResponse.json({
      text: (data.text ?? '').trim(),
      language: normalizeLanguage(data.language),
      model,
    })
  } catch (error) {
    console.error('transcribe error:', error)
    return NextResponse.json(
      { error: 'Server error during transcription' },
      { status: 500 }
    )
  }
}
