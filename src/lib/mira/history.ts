// MIRA — conversation history persistence. Raw SQL so this ships without waiting
// on another Prisma client regen. Free-form LLM text NEVER lands in decision_ledger.

import { Prisma, type PrismaClient } from '@prisma/client'

export const DEFAULT_SESSION_ID = 'default'
export const HISTORY_LIMIT = 60

export type PersistedMessage = {
  id: string
  user_id: string
  session_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | null
  tool_calls: unknown | null
  tool_call_id: string | null
  created_at: string
}

type InsertInput = {
  userId: string
  sessionId?: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content?: string | null
  toolCalls?: unknown
  toolCallId?: string | null
}

export async function appendConversationMessage(prisma: PrismaClient, input: InsertInput): Promise<void> {
  const sessionId = input.sessionId ?? DEFAULT_SESSION_ID
  const content = input.content ?? null
  const toolCalls = input.toolCalls !== undefined ? JSON.stringify(input.toolCalls) : null
  const toolCallId = input.toolCallId ?? null

  await prisma.$executeRaw`
    INSERT INTO public.mira_conversation_history
      (user_id, session_id, role, content, tool_calls, tool_call_id)
    VALUES
      (${input.userId}::uuid,
       ${sessionId},
       ${input.role},
       ${content},
       ${toolCalls}::jsonb,
       ${toolCallId})
  `
}

export async function loadConversationHistory(
  prisma: PrismaClient,
  userId: string,
  sessionId: string = DEFAULT_SESSION_ID,
  limit: number = HISTORY_LIMIT,
): Promise<PersistedMessage[]> {
  const rows = await prisma.$queryRaw<Array<{
    id: string
    user_id: string
    session_id: string
    role: string
    content: string | null
    tool_calls: unknown
    tool_call_id: string | null
    created_at: Date
  }>>`
    SELECT id, user_id, session_id, role, content, tool_calls, tool_call_id, created_at
    FROM public.mira_conversation_history
    WHERE user_id = ${userId}::uuid AND session_id = ${sessionId}
    ORDER BY created_at ASC
    LIMIT ${Prisma.sql`${limit}`}
  `
  return rows.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    session_id: r.session_id,
    role: r.role as PersistedMessage['role'],
    content: r.content,
    tool_calls: r.tool_calls ?? null,
    tool_call_id: r.tool_call_id,
    created_at: r.created_at.toISOString(),
  }))
}

export async function clearConversationHistory(
  prisma: PrismaClient,
  userId: string,
  sessionId: string = DEFAULT_SESSION_ID,
): Promise<number> {
  const result = await prisma.$executeRaw`
    DELETE FROM public.mira_conversation_history
    WHERE user_id = ${userId}::uuid AND session_id = ${sessionId}
  `
  return Number(result ?? 0)
}
