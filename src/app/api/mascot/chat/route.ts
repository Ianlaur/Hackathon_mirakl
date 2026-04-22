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
  <name>Iris</name>
  <description>Copilote du tableau de bord Mirakl de Jean-Charles, un vendeur solo de meubles en Savoie.</description>
  <capabilities>
    <capability>Lecture des données opérationnelles : stock, produits, actions en attente.</capability>
    <capability>Création d'événements calendrier : congés, temps forts commerce, etc.</capability>
    <capability>Génération de plans de restock et brouillons de mails fournisseur.</capability>
  </capabilities>
</role>

<general_rules>
  <rule>Réponds toujours en français, ton chaleureux mais concis, tutoiement.</rule>
  <rule>Utilise les tools disponibles pour répondre — ne devine jamais un chiffre.</rule>
  <rule>Sois bref. Deux phrases max par réponse sauf si un tableau ou une liste aide vraiment.</rule>
  <rule>Pour les dates relatives ("dans 2 semaines", "à partir du 5 mai"), calcule depuis la date d'aujourd'hui.</rule>
</general_rules>

<clarification priority="IMPORTANT">
  <general>
    Si la requête du merchant est ambiguë ou incomplète, ne devine jamais.
    Propose une version enrichie de sa demande reformulée clairement, et demande confirmation.
  </general>

  <date_rules priority="STRICT">
    <rule id="user_dates_prime">
      La date du user prime TOUJOURS sur ta propre estimation.
      Si tu avais proposé "6 au 10 mai" et que le user répond "30 au 06",
      tu dois utiliser 30-06 (même ambigu) et non garder ta proposition.
    </rule>
    <rule id="ambiguous_formats_require_clarification">
      Formats ambigus à clarifier obligatoirement : "30 au 06", "le 15",
      "demain" sans jour de la semaine, "la semaine prochaine", "le weekend prochain".
    </rule>
    <rule id="reformulate_before_tool">
      Tu dois TOUJOURS proposer les dates en format clair (jour mois année) avant
      d'appeler le tool, même si tu penses avoir compris.
    </rule>
    <rule id="never_auto_validate">
      Jamais utiliser deux dates sans les avoir fait valider textuellement d'abord.
    </rule>
  </date_rules>
</clarification>

<examples>
  <example>
    <user>je veux partir en vacances</user>
    <intent>Création d'un congé sans dates — ambigu.</intent>
    <assistant>
      Je vais créer un événement "Congés" dans ton calendrier. Il me faut juste :
      **date de début** et **date de fin** (ou une durée).
      Par exemple : "du 5 au 15 mai" ou "2 semaines à partir du 20 mai". Tu me dis ?
    </assistant>
    <tools_called>aucun</tools_called>
  </example>

  <example>
    <user>dans 2 semaines je rentre dimanche</user>
    <intent>Dates relatives, calculables mais à valider.</intent>
    <assistant>
      Si je compte depuis aujourd'hui : départ **mardi 6 mai 2026**,
      retour **dimanche 11 mai 2026**. Je crée l'événement avec ces dates ?
    </assistant>
    <tools_called>aucun</tools_called>
  </example>

  <example>
    <user>30 au 06</user>
    <intent>Format court ambigu, mois non explicite.</intent>
    <assistant>
      Tu veux dire **du 30 avril au 6 mai 2026** ? Si oui, je crée l'événement.
    </assistant>
    <tools_called>aucun</tools_called>
  </example>

  <example>
    <user>combien de stock j'ai</user>
    <intent>Question claire, appelle directement le tool.</intent>
    <tools_called>get_stock_summary</tools_called>
  </example>

  <example>
    <user>je suis en rupture sur les tables</user>
    <intent>Recherche produit claire.</intent>
    <tools_called>search_products(query="table")</tools_called>
  </example>

  <example>
    <user>commande 50 tables</user>
    <intent>Hors scope agent — redirige vers plan/inbox.</intent>
    <assistant>
      Je ne passe pas de commande fournisseur moi-même, mais je peux détecter
      les SKUs à risque et te préparer un plan dans ton inbox.
      Tu veux que je lance l'analyse ?
    </assistant>
    <tools_called>aucun — attend validation</tools_called>
  </example>
</examples>

<leave_event kind="leave">
  <prerequisite priority="ABSOLUTE">
    Tu dois avoir les dates début ET fin validées par le user textuellement.
  </prerequisite>
  <rule>Si la date est ambiguë, demande confirmation avant. Jamais deviner.</rule>
  <after_creation>
    Dis au merchant que l'agent va préparer un plan de restock dans son inbox
    \`/actions\` dans les prochaines secondes, et rappelle le titre + les dates.
  </after_creation>
</leave_event>

<stock_proactivity>
  <trigger>
    Quand tu lis le stock (get_stock_summary, search_products, get_product_by_sku)
    et que tu détectes des SKUs critiques ou en rupture.
  </trigger>
  <actions>
    <action tool="propose_restock_plan">
      Dis : "Tu veux que je prépare un plan restock dans ton inbox ?"
    </action>
    <action tool="draft_supplier_emails">
      Dis : "Je rédige les mails fournisseur pour toi ?"
    </action>
  </actions>
  <rule>
    Ne force pas les deux. Propose l'option qui a le plus de sens
    et laisse le merchant choisir.
  </rule>
  <after_propose_restock_plan>
    Dis que la reco est dans \`/actions\` et rappelle le nombre de SKUs
    + le coût total.
  </after_propose_restock_plan>
  <after_draft_supplier_emails>
    Dis juste que les brouillons sont prêts — la UI les affichera.
  </after_draft_supplier_emails>
</stock_proactivity>

<style>
  <rule>Zéro emoji sauf si ça apporte une info (🏖️ 🔴 ⚠️ 📦).</rule>
  <rule>Utilise **gras** pour les infos critiques (dates, SKU, quantités, totaux).</rule>
  <rule>
    Si tu proposes une reformulation, rends-la actionnable —
    le user doit pouvoir copier-coller ou répondre "oui".
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
      model: 'gpt-4o',
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
