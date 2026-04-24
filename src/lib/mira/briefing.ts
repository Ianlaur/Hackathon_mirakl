import { prisma } from '@/lib/prisma'
import { detectConversationLanguage, type ConversationLanguage } from '@/lib/mira/conversation'

type BriefingMetrics = {
  pendingApprovals: number
  queuedDecisions: number
  lowStockSkus: number
  nextEventTitle: string | null
  nextEventDate: string | null
}

type BriefingLineBuilder = (metrics: BriefingMetrics) => string

const BRIEFING_BY_LANGUAGE: Record<ConversationLanguage, BriefingLineBuilder[]> = {
  en: [
    (m) => `Pending approvals: ${m.pendingApprovals}`,
    (m) => `Queued decisions: ${m.queuedDecisions}`,
    (m) => `Low-stock SKUs: ${m.lowStockSkus}`,
    (m) =>
      m.nextEventTitle && m.nextEventDate
        ? `Next event: ${m.nextEventTitle} on ${m.nextEventDate}`
        : 'Next event: none scheduled',
  ],
  fr: [
    (m) => `Validations en attente : ${m.pendingApprovals}`,
    (m) => `Decisions en file : ${m.queuedDecisions}`,
    (m) => `SKU en stock bas : ${m.lowStockSkus}`,
    (m) =>
      m.nextEventTitle && m.nextEventDate
        ? `Prochain evenement : ${m.nextEventTitle} le ${m.nextEventDate}`
        : 'Prochain evenement : aucun',
  ],
  it: [
    (m) => `Approvazioni in attesa: ${m.pendingApprovals}`,
    (m) => `Decisioni in coda: ${m.queuedDecisions}`,
    (m) => `SKU con stock basso: ${m.lowStockSkus}`,
    (m) =>
      m.nextEventTitle && m.nextEventDate
        ? `Prossimo evento: ${m.nextEventTitle} il ${m.nextEventDate}`
        : 'Prossimo evento: nessuno',
  ],
  de: [
    (m) => `Offene Freigaben: ${m.pendingApprovals}`,
    (m) => `Wartende Entscheidungen: ${m.queuedDecisions}`,
    (m) => `SKUs mit niedrigem Bestand: ${m.lowStockSkus}`,
    (m) =>
      m.nextEventTitle && m.nextEventDate
        ? `Naechstes Ereignis: ${m.nextEventTitle} am ${m.nextEventDate}`
        : 'Naechstes Ereignis: keines geplant',
  ],
  es: [
    (m) => `Aprobaciones pendientes: ${m.pendingApprovals}`,
    (m) => `Decisiones en cola: ${m.queuedDecisions}`,
    (m) => `SKU con stock bajo: ${m.lowStockSkus}`,
    (m) =>
      m.nextEventTitle && m.nextEventDate
        ? `Proximo evento: ${m.nextEventTitle} el ${m.nextEventDate}`
        : 'Proximo evento: ninguno',
  ],
}

export type MorningBriefing = {
  language: ConversationLanguage
  headline: string
  lines: string[]
  generatedAt: string
}

export function buildBriefing(args: {
  language: ConversationLanguage
  metrics: BriefingMetrics
  now?: Date
}): MorningBriefing {
  const now = args.now ?? new Date()
  const headlineByLanguage: Record<ConversationLanguage, string> = {
    en: 'Morning briefing',
    fr: 'Briefing du matin',
    it: 'Briefing del mattino',
    de: 'Morgenbriefing',
    es: 'Resumen de la manana',
  }

  return {
    language: args.language,
    headline: headlineByLanguage[args.language],
    lines: BRIEFING_BY_LANGUAGE[args.language].map((builder) => builder(args.metrics)),
    generatedAt: now.toISOString(),
  }
}

export async function getBriefingLanguageForUser(userId: string) {
  const lastUserMessage = await prisma.copilotChatMessage.findFirst({
    where: {
      user_id: userId,
      role: 'user',
    },
    orderBy: {
      created_at: 'desc',
    },
    select: {
      content: true,
    },
  })

  return lastUserMessage?.content
    ? detectConversationLanguage(lastUserMessage.content)
    : 'en'
}

export async function buildMorningBriefingForUser(userId: string) {
  const [language, pendingApprovals, nextEvent] = await Promise.all([
    getBriefingLanguageForUser(userId),
    prisma.agentRecommendation.count({
      where: {
        user_id: userId,
        status: 'pending_approval',
      },
    }),
    prisma.merchantCalendarEvent.findFirst({
      where: {
        user_id: userId,
        end_date: {
          gte: new Date(),
        },
      },
      orderBy: {
        start_date: 'asc',
      },
      select: {
        title: true,
        start_date: true,
      },
    }),
  ])

  const [queuedRows, lowStockRows] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*) AS count
      FROM public.decision_ledger
      WHERE user_id = ${userId}::uuid
        AND status = 'queued'
    `,
    prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*) AS count
      FROM public.products
      WHERE user_id = ${userId}::uuid
        AND active = true
        AND quantity <= min_quantity
    `,
  ])

  const queuedDecisions = Number(queuedRows[0]?.count ?? 0)
  const lowStockSkus = Number(lowStockRows[0]?.count ?? 0)

  return buildBriefing({
    language,
    metrics: {
      pendingApprovals,
      queuedDecisions,
      lowStockSkus,
      nextEventTitle: nextEvent?.title ?? null,
      nextEventDate: nextEvent?.start_date
        ? nextEvent.start_date.toISOString().slice(0, 10)
        : null,
    },
  })
}
