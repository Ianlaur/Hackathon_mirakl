import { prisma } from '@/lib/prisma'
import type { CatalogMappingProposal } from '@/lib/catalog-mapping'

export type CatalogReviewRecordDTO = CatalogMappingProposal & {
  id: string
  status: string
  channel: string | null
  created_at: string
}

type CatalogReviewRow = {
  id: string
  sku: string
  channel: string | null
  status: string
  review_payload: CatalogMappingProposal
  created_at: Date
}

export async function ensureCatalogReviewRecordsTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS public.catalog_review_records (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      sku text NOT NULL,
      channel text,
      review_payload jsonb NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
}

function toDTO(row: CatalogReviewRow): CatalogReviewRecordDTO {
  return {
    ...row.review_payload,
    id: row.id,
    sku: row.sku,
    channel: row.channel,
    status: row.status,
    created_at: row.created_at.toISOString(),
  }
}

export async function createCatalogReviewRecords(args: {
  userId: string
  channel?: string | null
  proposals: CatalogMappingProposal[]
}) {
  await ensureCatalogReviewRecordsTable()

  const rows: CatalogReviewRow[] = []
  for (const proposal of args.proposals) {
    const inserted = await prisma.$queryRaw<CatalogReviewRow[]>`
      INSERT INTO public.catalog_review_records (
        user_id,
        sku,
        channel,
        review_payload,
        status
      ) VALUES (
        ${args.userId}::uuid,
        ${proposal.sku},
        ${args.channel ?? 'mirakl'},
        ${proposal}::jsonb,
        'pending'
      )
      RETURNING id::text, sku, channel, status, review_payload, created_at
    `
    rows.push(inserted[0])
  }

  return rows.map(toDTO)
}

export async function listCatalogReviewRecords(userId: string) {
  await ensureCatalogReviewRecordsTable()

  const rows = await prisma.$queryRaw<CatalogReviewRow[]>`
    SELECT id::text, sku, channel, status, review_payload, created_at
    FROM public.catalog_review_records
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC
    LIMIT 200
  `

  return rows.map(toDTO)
}

export async function updateCatalogReviewRecord(args: {
  userId: string
  id: string
  status: 'pending' | 'approved' | 'modified' | 'rejected'
  proposedValue?: string | null
}) {
  await ensureCatalogReviewRecordsTable()

  const patch = {
    review_action: args.status,
    ...(args.proposedValue !== undefined ? { proposed_value: args.proposedValue ?? '' } : {}),
  }

  const rows = await prisma.$queryRaw<CatalogReviewRow[]>`
    UPDATE public.catalog_review_records
    SET
      status = ${args.status},
      review_payload = review_payload || ${patch}::jsonb
    WHERE id = ${args.id}::uuid
      AND user_id = ${args.userId}::uuid
    RETURNING id::text, sku, channel, status, review_payload, created_at
  `

  return rows[0] ? toDTO(rows[0]) : null
}
