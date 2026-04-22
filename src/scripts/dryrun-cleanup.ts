import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const USER_ID = process.env.HACKATHON_USER_ID

async function count(label: string, query: () => Promise<unknown>) {
  try {
    const rows = (await query()) as Array<{ cnt: number }>
    console.log(`  ${label.padEnd(60)} ${rows[0]?.cnt ?? 0}`)
  } catch (err) {
    console.log(`  ${label.padEnd(60)} ERR: ${(err as Error).message.slice(0, 50)}`)
  }
}

async function main() {
  if (!USER_ID) {
    console.error('HACKATHON_USER_ID required')
    process.exit(1)
  }

  console.log('\n=== DRY-RUN : état actuel de la BDD ===\n')

  console.log('--- DONNÉES NORDIKA DE BASE (intouchables) ---')
  await count(
    'data_orders_amazon',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.data_orders_amazon`
  )
  await count(
    'data_orders_google',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.data_orders_google`
  )
  await count(
    'data_messages_amazon',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.data_messages_amazon`
  )
  await count(
    'data_messages_google',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.data_messages_google`
  )
  await count(
    'data_supplier_catalog_nordika_200',
    () =>
      prisma.$queryRaw`SELECT count(*)::int cnt FROM public.data_supplier_catalog_nordika_200`
  )

  console.log('\n--- TABLES SEED IANLAUR (à garder probablement) ---')
  await count(
    'calendar_events (jours fériés FR + temps forts + tests)',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.calendar_events WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    '└─ dont kind=holiday',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.calendar_events WHERE user_id = ${USER_ID}::uuid AND kind='holiday'`
  )
  await count(
    '└─ dont kind=commerce',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.calendar_events WHERE user_id = ${USER_ID}::uuid AND kind='commerce'`
  )
  await count(
    '└─ dont kind=leave (créés par tests Iris / démo)',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.calendar_events WHERE user_id = ${USER_ID}::uuid AND kind='leave'`
  )
  await count(
    '└─ autres kinds',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.calendar_events WHERE user_id = ${USER_ID}::uuid AND kind NOT IN ('holiday','commerce','leave')`
  )
  await count(
    'loss_events',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.loss_events WHERE user_id = ${USER_ID}::uuid`
  )

  console.log('\n--- CRÉÉES PAR NOUS (import + seed + tests) ---')
  await count(
    'products (importés depuis data_supplier_catalog)',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.products WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'stock_movements',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.stock_movements WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'stock_low_alerts',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.stock_low_alerts WHERE user_id = ${USER_ID}::uuid`
  )

  console.log('\n--- TESTS IRIS / AGENT (recos + chat) ---')
  await count(
    'agent_recommendations (toutes)',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.agent_recommendations WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    '└─ calendar_restock_plan',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.agent_recommendations WHERE user_id = ${USER_ID}::uuid AND scenario_type='calendar_restock_plan'`
  )
  await count(
    '└─ restock_plan_manual',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.agent_recommendations WHERE user_id = ${USER_ID}::uuid AND scenario_type='restock_plan_manual'`
  )
  await count(
    '└─ autres scenarios (ianlaur copilot)',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.agent_recommendations WHERE user_id = ${USER_ID}::uuid AND scenario_type NOT IN ('calendar_restock_plan','restock_plan_manual')`
  )
  await count(
    'recommendation_approvals',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.recommendation_approvals WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'agent_execution_runs',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.agent_execution_runs WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'copilot_chat_sessions',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.copilot_chat_sessions WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'copilot_chat_messages',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.copilot_chat_messages WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'agent_context_snapshots',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.agent_context_snapshots WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'external_context_signals',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.external_context_signals WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'merchant_ai_settings',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.merchant_ai_settings WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'merchant_profile_context',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.merchant_profile_context WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'merchant_calendar_events',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.merchant_calendar_events WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'parcels',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.parcels WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'warehouse_zones',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.warehouse_zones WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'warehouse_bins',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.warehouse_bins WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'bin_contents',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.bin_contents WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'picking_lists',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.picking_lists WHERE user_id = ${USER_ID}::uuid`
  )
  await count(
    'picking_tasks',
    () => prisma.$queryRaw`SELECT count(*)::int cnt FROM public.picking_tasks WHERE user_id = ${USER_ID}::uuid`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
