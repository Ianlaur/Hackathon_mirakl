import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEMO_USER_ID = process.env.HACKATHON_USER_ID
if (!DEMO_USER_ID) {
  console.error('HACKATHON_USER_ID env var required')
  process.exit(1)
}

async function main() {
  // 1. Bascule quelques SKUs à stock critique pour que le calcul déterministe les flag
  const criticalSkus = ['NKS-00042', 'NKS-00021', 'NKS-00100', 'NKS-00055', 'NKS-00079']
  const products = await prisma.product.findMany({
    where: { user_id: DEMO_USER_ID!, sku: { in: criticalSkus } },
  })

  for (const p of products) {
    const newQty = Math.max(1, Math.floor((p.min_quantity || 10) * 0.4))
    await prisma.product.update({
      where: { id: p.id },
      data: { quantity: newQty },
    })
    console.log(`Stock ${p.sku} → ${newQty}`)
  }

  // 2. Event congés ~10 jours → +20 jours
  const in10d = new Date(Date.now() + 10 * 24 * 3600 * 1000)
  const in20d = new Date(Date.now() + 20 * 24 * 3600 * 1000)

  const existing: Array<{ id: string }> = await prisma.$queryRaw`
    SELECT id FROM public.calendar_events
    WHERE user_id = ${DEMO_USER_ID}::uuid
      AND title = 'Congés Savoie - Démo'
    LIMIT 1
  `

  if (existing.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO public.calendar_events (user_id, title, start_at, end_at, kind, impact, notes)
      VALUES (
        ${DEMO_USER_ID}::uuid,
        'Congés Savoie - Démo',
        ${in10d},
        ${in20d},
        'leave',
        'high',
        'Événement seedé pour la démo Loom'
      )
    `
    console.log('Created demo leave event')
  } else {
    console.log('Demo leave event already exists, skipping create')
  }

  // 3. Afficher l'ID de l'event démo
  const eventRows: Array<{ id: string; start_at: Date; end_at: Date }> = await prisma.$queryRaw`
    SELECT id, start_at, end_at FROM public.calendar_events
    WHERE user_id = ${DEMO_USER_ID}::uuid
      AND title = 'Congés Savoie - Démo'
    LIMIT 1
  `
  if (eventRows.length > 0) {
    console.log(`\nDemo event UUID: ${eventRows[0].id}`)
    console.log(`Trigger avec : curl -X POST "http://localhost:3000/api/agent/calendar-advisor/trigger?event_id=${eventRows[0].id}"`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
