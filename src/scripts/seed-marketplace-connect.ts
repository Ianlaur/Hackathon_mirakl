// Seeds marketplace_proposals + dialogue + messages so the UI has real data.
// Idempotent (upserts by user + name).
//
// Run: npx ts-node --project tsconfig.scripts.json scripts/seed-marketplace-connect.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const USER_ID = process.env.HACKATHON_USER_ID ?? '00000000-0000-0000-0000-000000000001'

const PROPOSALS = [
  {
    name: 'Darty',
    category: 'Electronics & Home',
    daily_users: '2.4M',
    last_year_revenue: '€850M',
    status: 'pending',
    about:
      'Leading French electronics retailer. Integrating provides access to a highly qualified consumer base focused on home appliances, computing, and high-end consumer electronics.',
    match_score: 94,
    risk_signal:
      'Pricing for Black Friday must be finalized by Nov 1st to ensure placement.',
    source: 'mirakl_connect_api',
    requirements: [
      { label: 'Mirakl API Key', status: 'ok', position: 0 },
      { label: 'Catalog Matching (94%)', status: 'ok', position: 1 },
      { label: 'Shipping Policy Review', status: 'warn', position: 2 },
      { label: 'Contract Signature', status: 'pending', position: 3 },
    ],
  },
  {
    name: 'Carrefour',
    category: 'Retail Giant',
    daily_users: '4.8M',
    last_year_revenue: '€1.2B',
    status: 'pending',
    about: 'French retail giant with strong footprint across EU and LATAM.',
    match_score: 78,
    source: 'mirakl_connect_api',
    requirements: [
      { label: 'Mirakl API Key', status: 'ok', position: 0 },
      { label: 'Catalog Matching (78%)', status: 'warn', position: 1 },
      { label: 'Shipping Policy Review', status: 'pending', position: 2 },
      { label: 'Contract Signature', status: 'pending', position: 3 },
    ],
  },
  {
    name: 'Auchan',
    category: 'Hypermarket Chain',
    daily_users: '3.1M',
    last_year_revenue: '€920M',
    status: 'pending',
    about: 'European hypermarket chain with Mirakl-powered marketplace.',
    match_score: 72,
    source: 'mirakl_connect_api',
    requirements: [
      { label: 'Mirakl API Key', status: 'ok', position: 0 },
      { label: 'Catalog Matching (72%)', status: 'warn', position: 1 },
      { label: 'Shipping Policy Review', status: 'pending', position: 2 },
      { label: 'Contract Signature', status: 'pending', position: 3 },
    ],
  },
  {
    name: 'ManoMano',
    category: 'DIY & Garden',
    daily_users: '1.8M',
    last_year_revenue: '€540M',
    status: 'pending',
    about: 'European specialist for DIY, home improvement, and gardening.',
    match_score: 66,
    source: 'mirakl_connect_api',
    requirements: [
      { label: 'Mirakl API Key', status: 'ok', position: 0 },
      { label: 'Catalog Matching (66%)', status: 'warn', position: 1 },
      { label: 'Shipping Policy Review', status: 'pending', position: 2 },
      { label: 'Contract Signature', status: 'pending', position: 3 },
    ],
  },
]

const DARTY_MESSAGES: Array<{ sender: string; body: string; autopilot?: boolean; offsetMinutes: number }> = [
  {
    sender: 'counterpart',
    body:
      'Hello Fanny, we have reviewed your "Luxe Boutique" catalog. We would like to propose a premium placement on our Home & Tech section for the upcoming Black Friday period. Would you be open to syncing your inventory via Mirakl Connect?',
    offsetMinutes: -240,
  },
  {
    sender: 'mira',
    body:
      'MIRA has analyzed the proposal. Integration compatibility for Black Friday is 94%. I have prepared the initial category mapping for your approval.',
    autopilot: true,
    offsetMinutes: -180,
  },
  {
    sender: 'counterpart',
    body:
      "Perfect. We've sent the technical requirements for the API sync. Please confirm once you've had a chance to look at the shipping categories.",
    offsetMinutes: -30,
  },
]

async function main() {
  console.log(`Seeding marketplace_proposals for user ${USER_ID}…`)

  for (const p of PROPOSALS) {
    const existing = await prisma.marketplaceProposal.findFirst({
      where: { user_id: USER_ID, name: p.name },
      select: { id: true },
    })

    const proposalId = existing
      ? existing.id
      : (
          await prisma.marketplaceProposal.create({
            data: {
              user_id: USER_ID,
              name: p.name,
              category: p.category,
              daily_users: p.daily_users,
              last_year_revenue: p.last_year_revenue,
              status: p.status,
              about: p.about,
              match_score: p.match_score,
              risk_signal: p.risk_signal,
              source: p.source,
            },
            select: { id: true },
          })
        ).id

    // Replace requirements idempotently.
    await prisma.marketplaceRequirement.deleteMany({ where: { proposal_id: proposalId } })
    if (p.requirements.length > 0) {
      await prisma.marketplaceRequirement.createMany({
        data: p.requirements.map((r) => ({
          proposal_id: proposalId,
          label: r.label,
          status: r.status,
          position: r.position,
        })),
      })
    }

    console.log(`  ok ${p.name} (id=${proposalId})`)
  }

  // Seed a dialogue for Darty with 3 messages.
  const dartyProposal = await prisma.marketplaceProposal.findFirst({
    where: { user_id: USER_ID, name: 'Darty' },
    select: { id: true },
  })

  if (dartyProposal) {
    let dialogue = await prisma.marketplaceDialogue.findFirst({
      where: { user_id: USER_ID, proposal_id: dartyProposal.id },
      select: { id: true },
    })
    if (!dialogue) {
      dialogue = await prisma.marketplaceDialogue.create({
        data: {
          user_id: USER_ID,
          proposal_id: dartyProposal.id,
          counterpart_name: 'Darty',
        },
        select: { id: true },
      })
    }

    // Replace messages to stay idempotent.
    await prisma.marketplaceMessage.deleteMany({ where: { dialogue_id: dialogue.id } })
    const now = Date.now()
    await prisma.marketplaceMessage.createMany({
      data: DARTY_MESSAGES.map((m) => ({
        dialogue_id: dialogue!.id,
        sender: m.sender,
        body: m.body,
        autopilot: m.autopilot ?? false,
        created_at: new Date(now + m.offsetMinutes * 60_000),
      })),
    })

    const last = DARTY_MESSAGES[DARTY_MESSAGES.length - 1]
    await prisma.marketplaceDialogue.update({
      where: { id: dialogue.id },
      data: {
        last_message_preview: last.body.slice(0, 120),
        last_message_at: new Date(now + last.offsetMinutes * 60_000),
      },
    })
    console.log(`  ok dialogue Darty (${DARTY_MESSAGES.length} messages)`)
  }

  console.log('Seed complete.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
