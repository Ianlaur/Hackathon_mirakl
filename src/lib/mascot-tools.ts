import { prisma } from '@/lib/prisma'
import { buildPlanItems, summarizePlan } from '@/lib/calendar-restock'
import { requiresExplicitCalendarConfirmation } from '@/lib/calendar-confirmation'
import { listDecisionLedgerRows } from '@/lib/mira/ledger'

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
      name: 'query_decisions',
      description:
        'Reads governed decisions from the decision ledger. Use this when the merchant asks what happened with a SKU, why a channel was paused, what is queued, or what LEIA decided recently.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'Optional SKU filter, ex: NKS-00108' },
          status: {
            type: 'string',
            description: 'Optional status filter, ex: proposed, queued, auto_executed, rejected, overridden',
          },
          limit: { type: 'number', description: 'Optional limit, default 5, max 20' },
        },
        required: [],
      },
    },
  },
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
          confirmed: {
            type: 'boolean',
            description: "Mettre true uniquement après validation explicite du merchant. Obligatoire pour un congé.",
          },
        },
        required: ['title', 'start_date', 'end_date', 'kind'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_restock_plan',
      description:
        "Génère un plan de réapprovisionnement pour les SKUs à risque de rupture sur un horizon donné (par défaut 30 jours). Crée une recommandation dans l'inbox /actions que le merchant peut approuver/rejeter. À utiliser quand le merchant demande 'prépare un plan restock', 'commande ce qu'il faut', ou après avoir détecté des stocks critiques.",
      parameters: {
        type: 'object',
        properties: {
          horizon_days: {
            type: 'number',
            description: 'Nombre de jours de couverture ciblés (défaut 30)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_supplier_emails',
      description:
        "Génère des brouillons d'emails fournisseur, un par fournisseur concerné, pour commander les SKUs sous seuil. Retourne le sujet et le corps de chaque mail. Les mails ne sont PAS envoyés, uniquement préparés pour que le merchant les copie/colle ou les valide avant envoi. À utiliser quand le merchant demande 'écris les mails fournisseurs', 'prépare les commandes', 'rédige les relances'.",
      parameters: {
        type: 'object',
        properties: {
          horizon_days: {
            type: 'number',
            description: 'Horizon de couverture en jours pour calculer les quantités (défaut 30)',
          },
        },
        required: [],
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
    case 'query_decisions': {
      const sku = String(args.sku ?? '').trim().toLowerCase()
      const status = String(args.status ?? '').trim().toLowerCase()
      const limit = Math.max(1, Math.min(20, Number(args.limit ?? 5) || 5))
      const rows = await listDecisionLedgerRows(100)
      const filtered = rows
        .filter((row) => row.user_id === ctx.userId)
        .filter((row) => !sku || String(row.sku || '').toLowerCase() === sku)
        .filter((row) => !status || String(row.status || '').toLowerCase() === status)
        .slice(0, limit)

      return {
        count: filtered.length,
        decisions: filtered.map((row) => ({
          id: row.id,
          sku: row.sku,
          channel: row.channel,
          action_type: row.action_type,
          template_id: row.template_id,
          logical_inference: row.logical_inference,
          status: row.status,
          created_at: row.created_at.toISOString(),
        })),
      }
    }

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
      const confirmed = args.confirmed

      if (!title || !start || !end) {
        return { ok: false, error: 'title, start_date, end_date requis' }
      }

      if (requiresExplicitCalendarConfirmation(kind, confirmed)) {
        return {
          ok: true,
          pending_confirmation: true,
          message:
            "Validation requise avant ajout au calendrier. Confirme avec 'oui' pour créer l'événement.",
          event: {
            title,
            start,
            end,
            kind,
          },
          advisor_triggered: false,
        }
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

    case 'propose_restock_plan': {
      const horizonDays = Math.max(
        7,
        Math.min(120, Number(args.horizon_days ?? 30) || 30)
      )
      const plan = await buildRestockPlanForUser(ctx.userId, horizonDays)
      if (plan.items.length === 0) {
        return {
          ok: true,
          created: false,
          horizon_days: horizonDays,
          message: 'Aucun SKU sous risque de rupture sur cet horizon, pas de plan nécessaire.',
        }
      }

      const title = `📦 Plan restock — ${plan.items.length} SKU critique${plan.items.length > 1 ? 's' : ''} (${horizonDays}j)`
      const reasoning = `Sur les ${horizonDays} prochains jours, ${plan.items.length} produits risquent la rupture. Total estimé ${plan.totalCost.toFixed(0)} €.`

      const reco = await prisma.agentRecommendation.create({
        data: {
          user_id: ctx.userId,
          title,
          scenario_type: 'restock_plan_manual',
          status: 'pending_approval',
          reasoning_summary: reasoning,
          expected_impact: `Éviter ${plan.items.length} ruptures potentielles et protéger environ ${plan.totalCost.toFixed(0)} € de chiffre d'affaires.`,
          confidence_note: 'Confiance élevée sur le filtrage déterministe, à valider par le merchant.',
          evidence_payload: [
            { label: 'Horizon', value: `${horizonDays} jours` },
            { label: 'SKUs analysés', value: String(plan.productsCount) },
            { label: 'SKUs à risque', value: String(plan.items.length) },
            {
              label: 'Deadline commande au plus tard',
              value: plan.earliestDeadline ?? '—',
            },
            { label: 'Coût total estimé', value: `${plan.totalCost.toFixed(2)} €` },
          ],
          action_payload: {
            horizon_days: horizonDays,
            order_deadline: plan.earliestDeadline,
            total_estimated_cost_eur: plan.totalCost,
            items_count: plan.items.length,
            target: 'restock_plan_manual',
            supplementary_notes: [],
            items: plan.items,
          },
          approval_required: true,
          source: 'mascot_iris',
        },
      })

      return {
        ok: true,
        created: true,
        recommendation_id: reco.id,
        horizon_days: horizonDays,
        items_count: plan.items.length,
        total_estimated_cost_eur: plan.totalCost,
      }
    }

    case 'draft_supplier_emails': {
      const horizonDays = Math.max(
        7,
        Math.min(120, Number(args.horizon_days ?? 30) || 30)
      )
      const plan = await buildRestockPlanForUser(ctx.userId, horizonDays)
      if (plan.items.length === 0) {
        return {
          ok: true,
          drafts: [],
          message: "Rien à commander pour l'instant, aucun SKU sous risque de rupture.",
        }
      }

      const profile = await prisma.merchantProfileContext.findUnique({
        where: { user_id: ctx.userId },
      })
      const merchantName = profile?.merchant_category ?? 'Nordika Studio'

      // Grouper par fournisseur
      const grouped = new Map<string, typeof plan.items>()
      for (const item of plan.items) {
        const key = item.supplier ?? 'Fournisseur inconnu'
        const arr = grouped.get(key) ?? []
        arr.push(item)
        grouped.set(key, arr)
      }

      const drafts = Array.from(grouped.entries()).map(([supplier, items]) => {
        const total = items.reduce((s, i) => s + (i.estimated_cost_eur ?? 0), 0)
        const earliestDeadline = items
          .map((i) => i.order_deadline)
          .filter(Boolean)
          .sort()[0]

        const tableLines = items
          .map(
            (i) =>
              `- ${i.sku ?? '?'} — ${i.product_name} — ${i.recommended_qty} unités @ ${(i.unit_cost_eur ?? 0).toFixed(2)} € = ${(i.estimated_cost_eur ?? 0).toFixed(2)} €`
          )
          .join('\n')

        const subject = `Commande ${merchantName} — ${items.length} référence${items.length > 1 ? 's' : ''} (${items.reduce((s, i) => s + i.recommended_qty, 0)} unités)`

        const body =
          `Bonjour,\n\n` +
          `J'espère que vous allez bien. Je vous sollicite pour une commande de réassort :\n\n` +
          tableLines +
          `\n\nTotal estimé : ${total.toFixed(2)} €\n` +
          (earliestDeadline
            ? `Idéalement livrée avant le ${earliestDeadline} pour éviter toute rupture.\n\n`
            : `\n`) +
          `Merci de me confirmer disponibilité, délai de livraison et facture pro forma.\n\n` +
          `Bien cordialement,\n` +
          `Jean-Charles — ${merchantName}`

        return {
          supplier,
          subject,
          body,
          items_count: items.length,
          total_units: items.reduce((s, i) => s + i.recommended_qty, 0),
          total_cost_eur: Number(total.toFixed(2)),
          order_deadline: earliestDeadline ?? null,
        }
      })

      return {
        ok: true,
        drafts,
        horizon_days: horizonDays,
      }
    }

    default:
      return { error: `Tool ${name} not implemented` }
  }
}

async function buildRestockPlanForUser(userId: string, horizonDays: number) {
  const products = await prisma.product.findMany({
    where: { user_id: userId, active: true },
    select: {
      id: true,
      sku: true,
      name: true,
      quantity: true,
      supplier: true,
      supplier_lead_time_days: true,
      supplier_unit_cost_eur: true,
    },
  })

  type OrderCountRow = { sku: string; cnt: number }
  const orderCounts = await prisma.$queryRaw<OrderCountRow[]>`
    SELECT sku, SUM(qty)::int AS cnt
    FROM (
      SELECT (item->>'SellerSKU') AS sku, COALESCE((item->>'QuantityOrdered')::int, 1) AS qty
      FROM public.data_orders_amazon o,
           jsonb_array_elements(o.order_items) AS item
      WHERE o.purchase_date >= NOW() - INTERVAL '60 days'
      UNION ALL
      SELECT (item->>'product_sku') AS sku, COALESCE((item->>'quantity')::int, 1) AS qty
      FROM public.data_orders_google o,
           jsonb_array_elements(o.line_items) AS item
      WHERE o.created_at >= NOW() - INTERVAL '60 days'
    ) x
    WHERE sku IS NOT NULL
    GROUP BY sku
  `
  const ordersMap = new Map(orderCounts.map((r) => [r.sku, r.cnt]))

  const today = new Date()
  const leaveEnd = new Date(today.getTime() + horizonDays * 24 * 3600 * 1000)

  const items = buildPlanItems({
    today,
    leaveStart: today,
    leaveEnd,
    products: products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      currentStock: p.quantity,
      supplier: p.supplier,
      supplierLeadTimeDays: p.supplier_lead_time_days ?? 7,
      supplierUnitCostEur: Number(p.supplier_unit_cost_eur ?? 0),
    })),
    orders: products.map((p) => ({
      productId: p.id,
      orders60d: p.sku ? (ordersMap.get(p.sku) ?? 0) : 0,
    })),
  })

  const summary = summarizePlan(items)

  return {
    productsCount: products.length,
    items: items.map((i) => ({
      product_id: i.productId,
      sku: i.sku,
      product_name: i.productName,
      current_stock: i.currentStock,
      velocity_per_day: i.velocityPerDay,
      projected_stock_end_of_leave: i.projectedStockEndOfLeave,
      recommended_qty: i.recommendedQty,
      supplier: i.supplier,
      lead_time_days: i.leadTimeDays,
      unit_cost_eur: i.unitCostEur,
      estimated_cost_eur: i.estimatedCostEur,
      priority: i.priority,
      order_deadline: i.orderDeadline.toISOString().slice(0, 10),
      reasoning: i.reasoning,
    })),
    totalCost: summary.totalCostEur,
    earliestDeadline: summary.earliestDeadline?.toISOString().slice(0, 10) ?? null,
  }
}
