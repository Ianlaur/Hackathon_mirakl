// MIRA — invariant test. Run via:
//   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/test-mira-invariant.ts
// Or via: npm run test:mira-invariant
//
// Exits 0 if the template registry is consistent across TS, the DB templates table,
// and every row already in decision_ledger. Exits 1 otherwise.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { templateIds } from '../lib/mira/templates'

const prisma = new PrismaClient()

type LedgerTemplateRow = { template_id: string }

async function main() {
  const tsKeys = new Set<string>(templateIds())

  const dbTemplates = await prisma.decisionTemplate.findMany({ select: { id: true } })
  const dbKeys = new Set<string>(dbTemplates.map((t) => t.id))

  const ledgerRows = await prisma.$queryRaw<LedgerTemplateRow[]>`
    SELECT DISTINCT template_id FROM public.decision_ledger
  `
  const ledgerKeys = new Set<string>(ledgerRows.map((r) => r.template_id))

  const errors: string[] = []

  Array.from(dbKeys).forEach((k) => {
    if (!tsKeys.has(k)) {
      errors.push(`DB registers "${k}" but lib/mira/templates.ts has no renderer for it`)
    }
  })
  Array.from(tsKeys).forEach((k) => {
    if (!dbKeys.has(k)) {
      errors.push(`TEMPLATES has "${k}" but it is not in public.decision_templates`)
    }
  })
  Array.from(ledgerKeys).forEach((k) => {
    if (!tsKeys.has(k)) {
      errors.push(`decision_ledger contains template_id "${k}" with no TS renderer`)
    }
  })

  if (errors.length > 0) {
    console.error('MIRA invariant FAILED:')
    for (const e of errors) console.error('  -', e)
    process.exit(1)
  }

  console.log(
    `MIRA invariant OK — ${tsKeys.size} templates consistent (TS ↔ decision_templates ↔ decision_ledger).`,
  )
}

main()
  .catch((error) => {
    console.error('MIRA invariant crashed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
