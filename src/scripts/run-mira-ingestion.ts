// MIRA — ingest source JSONL files into operational_objects.
// Usage (from src/):
//   npm run mira:ingest              # ingest + report
//   npm run mira:ingest -- --verify  # ingest then verify round-trip

import 'dotenv/config'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { DEFAULT_SOURCES, runIngestion, verifyRoundTrip } from '../lib/mira/ingestion'

async function main() {
  const userId = process.env.HACKATHON_USER_ID
  if (!userId) {
    throw new Error('HACKATHON_USER_ID is required in env (see .env.example).')
  }

  const dataDir = path.resolve(process.cwd(), '../docs/data')
  const sources = DEFAULT_SOURCES(dataDir)
  const prisma = new PrismaClient()

  try {
    const report = await runIngestion({ userId, sources, prisma })

    console.log('Ingestion report:')
    for (const source of sources) {
      const total = report.totalByLabel[source.label] ?? 0
      const inserted = report.insertedByLabel[source.label] ?? 0
      const skipped = report.skippedByLabel[source.label] ?? 0
      console.log(`  ${source.label.padEnd(20)} total=${total}  inserted=${inserted}  skipped=${skipped}`)
    }
    if (report.errors.length > 0) {
      console.error(`\n${report.errors.length} errors:`)
      for (const err of report.errors.slice(0, 10)) {
        console.error(`  ${err.label}: ${err.reason}`)
      }
      if (report.errors.length > 10) {
        console.error(`  ... ${report.errors.length - 10} more`)
      }
    }

    if (process.argv.includes('--verify')) {
      console.log('\nVerifying round-trip...')
      const verify = await verifyRoundTrip({ sources, prisma })
      console.log(`  checked=${verify.checked}  mismatched=${verify.mismatched}`)
      if (verify.mismatched > 0) {
        console.error('  samples:')
        for (const s of verify.samples) console.error(`    - ${s}`)
        process.exit(1)
      }
      console.log('  round-trip OK: raw_payload preserves every source line.')
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
