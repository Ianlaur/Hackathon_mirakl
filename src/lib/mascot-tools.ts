import { prisma } from '@/lib/prisma'

export type ToolDefinition = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export const MASCOT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_stock_summary',
      description:
        'Retourne un résumé du stock : nombre total de produits, produits en alerte (stock bas ou rupture), valeur totale estimée. À utiliser quand le merchant demande "où en est mon stock", "combien de produits", "quels sont les stocks bas".',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_by_sku',
      description:
        "Récupère les détails d'un produit spécifique par son SKU (ex: NKS-00042). Retourne nom, quantité, seuil min, fournisseur, prix de vente. À utiliser quand le merchant demande combien il a d'un produit précis.",
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'Le SKU du produit, ex: NKS-00042' },
        },
        required: ['sku'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_products',
      description:
        'Recherche des produits par mot-clé dans le nom. Retourne max 10 résultats. À utiliser quand le merchant cherche un type de produit (ex: "chaises", "tables").',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Mot-clé à rechercher' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_pending_actions',
      description:
        "Liste les recommandations en attente d'approbation dans l'inbox /actions. À utiliser quand le merchant demande ce qu'il a à faire, ce qui l'attend, ses actions en cours.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description:
        'Crée un événement dans le calendrier du merchant. Très utile pour les congés (kind=leave) qui déclenchent automatiquement une analyse de stock. Date format YYYY-MM-DD.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: "Titre de l'événement, ex: Congés Savoie" },
          start_date: { type: 'string', description: 'Date début YYYY-MM-DD' },
          end_date: { type: 'string', description: 'Date fin YYYY-MM-DD' },
          kind: {
            type: 'string',
            enum: ['commerce', 'holiday', 'leave', 'logistics', 'marketing', 'internal'],
            description: 'Type. Pour congés utiliser leave.',
          },
          impact: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Impact estimé',
          },
          notes: { type: 'string', description: 'Notes optionnelles' },
        },
        required: ['title', 'start_date', 'end_date', 'kind'],
      },
    },
  },
]

function toIsoNoon(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`)
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: { userId: string; origin: string }
): Promise<unknown> {
  switch (name) {
    case 'get_stock_summary': {
      const products = await prisma.product.findMany({
        where: { user_id: ctx.userId, active: true },
        select: {
          id: true,
          sku: true,
          name: true,
          quantity: true,
          min_quantity: true,
          selling_price: true,
        },
      })
      const lowStock = products.filter((p) => p.quantity <= p.min_quantity)
      const outOfStock = products.filter((p) => p.quantity === 0)
      const totalValue = products.reduce(
        (sum, p) => sum + Number(p.selling_price) * p.quantity,
        0
      )
      return {
        total_products: products.length,
        low_stock_count: lowStock.length,
        out_of_stock_count: outOfStock.length,
        total_inventory_value_eur: Number(totalValue.toFixed(2)),
        top_critical: lowStock.slice(0, 5).map((p) => ({
          sku: p.sku,
          name: p.name,
          quantity: p.quantity,
          min_quantity: p.min_quantity,
        })),
      }
    }

    case 'get_product_by_sku': {
      const sku = String(args.sku ?? '').trim()
      const product = await prisma.product.findFirst({
        where: { user_id: ctx.userId, sku: { equals: sku, mode: 'insensitive' } },
        select: {
          sku: true,
          name: true,
          quantity: true,
          min_quantity: true,
          selling_price: true,
          supplier: true,
          supplier_lead_time_days: true,
          supplier_unit_cost_eur: true,
        },
      })
      if (!product) {
        return { found: false, sku, message: `Aucun produit trouvé avec le SKU ${sku}` }
      }
      return {
        found: true,
        sku: product.sku,
        name: product.name,
        quantity: product.quantity,
        min_quantity: product.min_quantity,
        stock_status:
          product.quantity === 0
            ? 'out_of_stock'
            : product.quantity <= product.min_quantity
              ? 'low'
              : 'ok',
        selling_price_eur: Number(product.selling_price),
        supplier: product.supplier,
        supplier_lead_time_days: product.supplier_lead_time_days,
        supplier_unit_cost_eur: product.supplier_unit_cost_eur
          ? Number(product.supplier_unit_cost_eur)
          : null,
      }
    }

    case 'search_products': {
      const query = String(args.query ?? '').trim()
      if (!query) return { products: [] }
      const results = await prisma.product.findMany({
        where: {
          user_id: ctx.userId,
          active: true,
          name: { contains: query, mode: 'insensitive' },
        },
        select: {
          sku: true,
          name: true,
          quantity: true,
          min_quantity: true,
          selling_price: true,
        },
        take: 10,
      })
      return {
        query,
        count: results.length,
        products: results.map((p) => ({
          sku: p.sku,
          name: p.name,
          quantity: p.quantity,
          min_quantity: p.min_quantity,
          selling_price_eur: Number(p.selling_price),
          stock_status:
            p.quantity === 0
              ? 'out_of_stock'
              : p.quantity <= p.min_quantity
                ? 'low'
                : 'ok',
        })),
      }
    }

    case 'list_pending_actions': {
      const recos = await prisma.agentRecommendation.findMany({
        where: { user_id: ctx.userId, status: 'pending_approval' },
        orderBy: { created_at: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          scenario_type: true,
          reasoning_summary: true,
          expected_impact: true,
          created_at: true,
        },
      })
      return {
        count: recos.length,
        actions: recos.map((r) => ({
          id: r.id,
          title: r.title,
          scenario: r.scenario_type,
          reasoning: r.reasoning_summary,
          impact: r.expected_impact,
          created_at: r.created_at.toISOString(),
        })),
      }
    }

    case 'create_calendar_event': {
      const title = String(args.title ?? '').trim()
      const start = String(args.start_date ?? '')
      const end = String(args.end_date ?? '')
      const kind = String(args.kind ?? 'internal')
      const impact = String(args.impact ?? 'medium')
      const notes = args.notes ? String(args.notes) : null

      if (!title || !start || !end) {
        return { ok: false, error: 'title, start_date, end_date requis' }
      }

      const startTs = toIsoNoon(start)
      const endTs = toIsoNoon(end)

      const rows = await prisma.$queryRaw<
        Array<{ id: string; title: string; start_at: Date; end_at: Date; kind: string }>
      >`
        INSERT INTO public.calendar_events (
          user_id, title, start_at, end_at, kind, impact, notes, locked
        ) VALUES (
          ${ctx.userId}::uuid,
          ${title},
          ${startTs},
          ${endTs},
          ${kind},
          ${impact},
          ${notes},
          false
        )
        RETURNING id::text, title, start_at, end_at, kind
      `

      const created = rows[0]

      // Si c'est un event leave, déclencher l'agent advisor en parallèle
      // (même logique que le webhook n8n, mais en direct pour cas où n8n n'est pas actif)
      if (created.kind === 'leave') {
        fetch(`${ctx.origin}/api/agent/calendar-advisor`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_id: created.id, user_id: ctx.userId }),
        }).catch((err) => console.error('advisor trigger failed:', err))
      }

      return {
        ok: true,
        event: {
          id: created.id,
          title: created.title,
          start: created.start_at.toISOString().slice(0, 10),
          end: created.end_at.toISOString().slice(0, 10),
          kind: created.kind,
        },
        advisor_triggered: created.kind === 'leave',
      }
    }

    default:
      return { error: `Tool ${name} not implemented` }
  }
}
