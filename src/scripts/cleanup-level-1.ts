import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const USER_ID = process.env.HACKATHON_USER_ID

async function main() {
  if (!USER_ID) {
    console.error('HACKATHON_USER_ID required')
    process.exit(1)
  }

  console.log('\n=== CLEANUP NIVEAU 1 ===\n')

  // 1) Agent recommendations — CASCADE supprime approvals + execution_runs
  const recosDel = await prisma.$executeRaw`
    DELETE FROM public.agent_recommendations
    WHERE user_id = ${USER_ID}::uuid
  `
  console.log(`agent_recommendations supprimées (cascade approvals + runs) : ${recosDel}`)

  // 2) Stock low alerts
  const slaDel = await prisma.$executeRaw`
    DELETE FROM public.stock_low_alerts
    WHERE user_id = ${USER_ID}::uuid
  `
  console.log(`stock_low_alerts supprimées                                : ${slaDel}`)

  // 3) Calendar events kind='leave' (créés par nos tests Iris)
  const leavesDel = await prisma.$executeRaw`
    DELETE FROM public.calendar_events
    WHERE user_id = ${USER_ID}::uuid AND kind = 'leave'
  `
  console.log(`calendar_events (kind=leave) supprimés                      : ${leavesDel}`)

  console.log('\n=== VÉRIFICATION POST-CLEANUP ===\n')

  const recos = await prisma.$queryRaw<Array<{ cnt: number }>>`
    SELECT count(*)::int cnt FROM public.agent_recommendations WHERE user_id = ${USER_ID}::uuid
  `
  const approvals = await prisma.$queryRaw<Array<{ cnt: number }>>`
    SELECT count(*)::int cnt FROM public.recommendation_approvals WHERE user_id = ${USER_ID}::uuid
  `
  const runs = await prisma.$queryRaw<Array<{ cnt: number }>>`
    SELECT count(*)::int cnt FROM public.agent_execution_runs WHERE user_id = ${USER_ID}::uuid
  `
  const sla = await prisma.$queryRaw<Array<{ cnt: number }>>`
    SELECT count(*)::int cnt FROM public.stock_low_alerts WHERE user_id = ${USER_ID}::uuid
  `
  const leaves = await prisma.$queryRaw<Array<{ cnt: number }>>`
    SELECT count(*)::int cnt FROM public.calendar_events WHERE user_id = ${USER_ID}::uuid AND kind='leave'
  `
  const totalEvents = await prisma.$queryRaw<Array<{ cnt: number }>>`
    SELECT count(*)::int cnt FROM public.calendar_events WHERE user_id = ${USER_ID}::uuid
  `
  const products = await prisma.$queryRaw<Array<{ cnt: number }>>`
    SELECT count(*)::int cnt FROM public.products WHERE user_id = ${USER_ID}::uuid
  `

  console.log(`agent_recommendations restantes    : ${recos[0].cnt}`)
  console.log(`recommendation_approvals restantes : ${approvals[0].cnt}`)
  console.log(`agent_execution_runs restants      : ${runs[0].cnt}`)
  console.log(`stock_low_alerts restantes         : ${sla[0].cnt}`)
  console.log(`calendar_events kind=leave         : ${leaves[0].cnt}`)
  console.log(`calendar_events TOTAL              : ${totalEvents[0].cnt}  (holidays/commerce/autres préservés)`)
  console.log(`products                           : ${products[0].cnt}  (préservés)`)

  console.log('\n✓ Cleanup terminé.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
