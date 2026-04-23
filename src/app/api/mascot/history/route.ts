// MIRA — conversation history endpoints. Surfaces free-form LLM text ONLY from
// mira_conversation_history. Never reads from decision_ledger.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import {
  DEFAULT_SESSION_ID,
  HISTORY_LIMIT,
  clearConversationHistory,
  loadConversationHistory,
} from '@/lib/mira/history'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const url = new URL(request.url)
    const sessionId = url.searchParams.get('session_id') ?? DEFAULT_SESSION_ID
    const limitParam = Number(url.searchParams.get('limit') ?? HISTORY_LIMIT)
    const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : HISTORY_LIMIT, 1), 200)

    const messages = await loadConversationHistory(prisma, userId, sessionId, limit)
    return NextResponse.json({ count: messages.length, session_id: sessionId, messages })
  } catch (error) {
    console.error('history fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load history' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const sessionId = new URL(request.url).searchParams.get('session_id') ?? DEFAULT_SESSION_ID
    const cleared = await clearConversationHistory(prisma, userId, sessionId)
    return NextResponse.json({ cleared })
  } catch (error) {
    console.error('history clear error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear history' },
      { status: 500 },
    )
  }
}
