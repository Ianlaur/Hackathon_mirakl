import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const WHISPER_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions'
const DEFAULT_MODEL = 'whisper-1'
const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25 MB = limite OpenAI

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY non configurée côté serveur.' },
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

    // Pass `language` through only if the client explicitly sets it — otherwise
    // Whisper auto-detects (works for FR + EN and 50+ other languages).
    const language = (formData.get('language') as string | null)?.trim() || null
    const model = (formData.get('model') as string | null) || DEFAULT_MODEL

    const upstream = new FormData()
    upstream.append('file', file, file.name || 'audio.webm')
    upstream.append('model', model)
    if (language) upstream.append('language', language)
    upstream.append('response_format', 'json')

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
      language: data.language ?? language ?? 'auto',
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
