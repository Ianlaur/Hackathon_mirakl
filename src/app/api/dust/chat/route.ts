import { NextRequest, NextResponse } from 'next/server'
import {
  askSmartQuestion,
  getSuggestedQuestions,
  normalizeIncomingHistory,
  normalizeQuestion,
} from '@/lib/dust'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}))

    if (payload?.kind === 'suggestions') {
      const suggestions = await getSuggestedQuestions()
      return NextResponse.json(suggestions)
    }

    const message = normalizeQuestion(payload?.message)
    if (!message) {
      return NextResponse.json(
        { error: 'Votre question est vide, essayez avec une phrase courte.' },
        { status: 400 }
      )
    }

    const history = normalizeIncomingHistory(payload?.history).slice(-6)
    const result = await askSmartQuestion(message, history)

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Chat route error:', error)
    return NextResponse.json(
      { error: 'Impossible de recuperer vos donnees, reessayez.' },
      { status: 500 }
    )
  }
}
