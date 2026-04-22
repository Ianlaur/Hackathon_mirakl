import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUserId } from '@/lib/session'
import { MASCOT_TOOLS, executeTool } from '@/lib/mascot-tools'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().nullable().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal('function'),
        function: z.object({ name: z.string(), arguments: z.string() }),
      })
    )
    .optional(),
  name: z.string().optional(),
})

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1),
})

const SYSTEM_PROMPT = `Tu es Iris, la mascotte assistante du tableau de bord Mirakl de Jean-Charles, un vendeur solo de meubles en Savoie.

Tu as accès à ses données opérationnelles (stock, produits, actions en attente) et tu peux créer des événements dans son calendrier (congés, temps forts commerce, etc.).

Règles :
- Réponds toujours en français, ton chaleureux mais concis, tutoiement.
- Utilise les tools disponibles pour répondre — ne devine jamais un chiffre.
- Quand tu crées un événement "congés" (kind=leave), dis au merchant que l'agent va préparer un plan de restock dans son inbox /actions dans les prochaines secondes.
- Pour les dates relatives (ex "dans 2 semaines"), calcule depuis la date d'aujourd'hui.
- Si tu n'as pas assez d'infos pour appeler un tool, pose une question courte.
- Sois bref. Une à deux phrases par réponse sauf si un tableau ou une liste aide.`

type ChatMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content?: string | null
  tool_call_id?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  name?: string
}

async function callOpenAI(messages: ChatMessage[], apiKey: string) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      messages,
      tools: MASCOT_TOOLS,
    }),
  })
  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenAI ${response.status}: ${errText}`)
  }
  return response.json()
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY non configurée côté serveur." },
        { status: 500 }
      )
    }

    const userId = await getCurrentUserId()
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const origin = new URL(request.url).origin
    const today = new Date().toISOString().slice(0, 10)

    const messages: ChatMessage[] = [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\nAujourd'hui : ${today}.` },
      ...(parsed.data.messages as ChatMessage[]),
    ]

    const toolCallsTrace: Array<{ name: string; args: unknown; result: unknown }> = []

    // Tool use loop (max 5 iterations de sécurité)
    for (let i = 0; i < 5; i++) {
      const completion = await callOpenAI(messages, apiKey)
      const choice = completion.choices?.[0]
      if (!choice) {
        return NextResponse.json({ error: 'No completion' }, { status: 500 })
      }

      const assistantMsg = choice.message as ChatMessage

      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        messages.push({
          role: 'assistant',
          content: assistantMsg.content ?? '',
          tool_calls: assistantMsg.tool_calls,
        })

        for (const call of assistantMsg.tool_calls) {
          let parsedArgs: Record<string, unknown> = {}
          try {
            parsedArgs = JSON.parse(call.function.arguments || '{}')
          } catch {
            parsedArgs = {}
          }

          const result = await executeTool(call.function.name, parsedArgs, {
            userId,
            origin,
          })

          toolCallsTrace.push({
            name: call.function.name,
            args: parsedArgs,
            result,
          })

          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify(result),
          })
        }
        continue
      }

      // Pas de tool call → c'est la réponse finale
      return NextResponse.json({
        message: {
          role: 'assistant',
          content: assistantMsg.content ?? '',
        },
        tool_calls: toolCallsTrace,
      })
    }

    return NextResponse.json(
      { error: 'Trop de tool calls, boucle coupée.', tool_calls: toolCallsTrace },
      { status: 500 }
    )
  } catch (error) {
    console.error('mascot chat error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
