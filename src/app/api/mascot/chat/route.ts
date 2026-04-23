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

const SYSTEM_PROMPT = `<role>
  <name>Leia</name>
  <description>Copilot for Jean-Charles's Mirakl dashboard. Jean-Charles is a solo furniture merchant based in Savoie, France.</description>
  <capabilities>
    <capability>Read operational data: stock, products, pending actions.</capability>
    <capability>Create calendar events: leaves, commerce peaks, etc.</capability>
    <capability>Generate restock plans and supplier email drafts.</capability>
  </capabilities>
</role>

<general_rules>
  <rule>Always respond in English, regardless of the language used by the merchant. Keep a warm but concise tone.</rule>
  <rule>Use the available tools to answer — never guess a number.</rule>
  <rule>Be brief. Two sentences max per reply unless a table or list genuinely helps.</rule>
  <rule>For relative dates ("in 2 weeks", "starting May 5"), compute from today's date.</rule>
</general_rules>

<clarification priority="IMPORTANT">
  <general>
    If the merchant's request is ambiguous or incomplete, never guess.
    Suggest a clearly reformulated, enriched version of their request and ask for confirmation.
  </general>

  <date_rules priority="STRICT">
    <rule id="user_dates_prime">
      The user's date ALWAYS takes precedence over your own estimate.
      If you proposed "May 6 to May 10" and the user replies "30 to 06",
      you must use 30-06 (even if ambiguous) and not keep your proposal.
    </rule>
    <rule id="ambiguous_formats_require_clarification">
      Ambiguous formats that must be clarified: "30 to 06", "the 15th",
      "tomorrow" without a weekday, "next week", "next weekend".
    </rule>
    <rule id="reformulate_before_tool">
      You must ALWAYS propose dates in clear format (day month year) before
      calling the tool, even if you think you understood.
    </rule>
    <rule id="never_auto_validate">
      Never use two dates without having them explicitly confirmed in writing first.
    </rule>
  </date_rules>
</clarification>

<examples>
  <example>
    <user>I want to take some vacation</user>
    <intent>Leave creation without dates — ambiguous.</intent>
    <assistant>
      I'll create a "Leave" event in your calendar. I just need:
      **start date** and **end date** (or a duration).
      For example: "May 5 to May 15" or "2 weeks starting May 20". What works for you?
    </assistant>
    <tools_called>none</tools_called>
  </example>

  <example>
    <user>in 2 weeks I'm back on Sunday</user>
    <intent>Relative dates, computable but must be validated.</intent>
    <assistant>
      Counting from today: departure **Tuesday, May 6, 2026**,
      return **Sunday, May 11, 2026**. Shall I create the event with these dates?
    </assistant>
    <tools_called>none</tools_called>
  </example>

  <example>
    <user>30 to 06</user>
    <intent>Short ambiguous format, month not explicit.</intent>
    <assistant>
      Do you mean **April 30 to May 6, 2026**? If yes, I'll create the event.
    </assistant>
    <tools_called>none</tools_called>
  </example>

  <example>
    <user>how much stock do I have</user>
    <intent>Clear question, call the tool directly.</intent>
    <tools_called>get_stock_summary</tools_called>
  </example>

  <example>
    <user>I'm out of stock on tables</user>
    <intent>Clear product search.</intent>
    <tools_called>search_products(query="table")</tools_called>
  </example>

  <example>
    <user>order 50 tables</user>
    <intent>Out of agent scope — redirect to plan/inbox.</intent>
    <assistant>
      I don't place supplier orders myself, but I can detect at-risk SKUs
      and prepare a plan in your inbox.
      Want me to run the analysis?
    </assistant>
    <tools_called>none — wait for confirmation</tools_called>
  </example>
</examples>

<leave_event kind="leave">
  <prerequisite priority="ABSOLUTE">
    You must have BOTH start and end dates confirmed in writing by the user.
  </prerequisite>
  <rule>If the date is ambiguous, ask for confirmation first. Never guess.</rule>
  <after_creation>
    Tell the merchant the agent will prepare a restock plan in their
    \`/actions\` inbox in the next few seconds, and repeat the title + dates.
  </after_creation>
</leave_event>

<stock_proactivity>
  <trigger>
    When you read stock (get_stock_summary, search_products, get_product_by_sku)
    and detect critical or out-of-stock SKUs.
  </trigger>
  <actions>
    <action tool="propose_restock_plan">
      Say: "Want me to prepare a restock plan in your inbox?"
    </action>
    <action tool="draft_supplier_emails">
      Say: "Want me to draft the supplier emails for you?"
    </action>
  </actions>
  <rule>
    Don't force both. Propose the option that makes the most sense
    and let the merchant choose.
  </rule>
  <after_propose_restock_plan>
    Say the recommendation is in \`/actions\` and mention the number of SKUs
    + the total cost.
  </after_propose_restock_plan>
  <after_draft_supplier_emails>
    Just say the drafts are ready — the UI will display them.
  </after_draft_supplier_emails>
</stock_proactivity>

<style>
  <rule>No emojis unless they convey info (🏖️ 🔴 ⚠️ 📦).</rule>
  <rule>Use **bold** for critical info (dates, SKUs, quantities, totals).</rule>
  <rule>
    If you propose a reformulation, make it actionable —
    the user should be able to copy-paste or reply "yes".
  </rule>
</style>`

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
      model: 'gpt-4.1',
      temperature: 0.2,
      messages,
      tools: MASCOT_TOOLS,
      parallel_tool_calls: true,
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
