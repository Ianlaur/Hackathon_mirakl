import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.overrideRecord.findMany({
    orderBy: { created_at: 'desc' },
    take: 5,
    select: {
      id: true,
      decision_id: true,
      reason: true,
      previous_status: true,
      created_at: true,
    },
  })
  console.log(`override_records count (last 5):`, rows.length)
  for (const r of rows) {
    console.log('-', {
      decision_id: r.decision_id.slice(0, 8) + '...',
      reason: r.reason,
      previous_status: r.previous_status,
      created_at: r.created_at.toISOString(),
    })
  }
}

main().finally(() => prisma.$disconnect())
