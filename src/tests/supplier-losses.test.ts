import { afterEach, describe, expect, it, vi } from 'vitest'

import { runLeiaToolCallingConversation } from '@/lib/leia-chat'
import {
  declareSupplierLoss,
  getRadarSnapshot,
  ensureSupplierLossesTable,
} from '@/lib/mira/supplier-losses'
import { prisma } from '@/lib/prisma'

const USER_ID = process.env.HACKATHON_USER_ID || '00000000-0000-0000-0000-000000000001'
const TEST_NOTES = 'vitest supplier loss declaration'

async function cleanupSupplierLosses() {
  await ensureSupplierLossesTable()
  const rows = await prisma.$queryRaw<Array<{ decision_id: string | null }>>`
    SELECT decision_id::text
    FROM public.supplier_losses
    WHERE notes = ${TEST_NOTES}
  `
  await prisma.$executeRaw`
    DELETE FROM public.supplier_losses
    WHERE notes = ${TEST_NOTES}
  `

  const decisionIds = rows
    .map((row) => row.decision_id)
    .filter((id): id is string => Boolean(id))

  if (decisionIds.length > 0) {
    await prisma.$executeRaw`
      DELETE FROM public.decision_ledger
      WHERE id::text = ANY(${decisionIds})
    `
  }
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await cleanupSupplierLosses()
})

describe('supplier losses management', () => {
  it('declares a supplier loss, writes the English ledger trace, and updates Radar aggregates', async () => {
    await cleanupSupplierLosses()

    const result = await declareSupplierLoss({
      userId: USER_ID,
      supplier_name: 'Bois & Design',
      sku: 'NRD-CHAIR-012',
      loss_type: 'delivery_short',
      quantity: 5,
      notes: TEST_NOTES,
    })

    expect(result.ok).toBe(true)
    expect(result.estimated_cost_eur).toBe(212.5)
    expect(result.supplier_loss_count_90d).toBeGreaterThanOrEqual(1)
    expect(result.reasoning).toContain(
      'Supplier loss declared: Bois & Design short-delivered 5 units of NRD-CHAIR-012'
    )

    const ledgerRows = await prisma.$queryRaw<Array<{ template_id: string; logical_inference: string }>>`
      SELECT template_id, logical_inference
      FROM public.decision_ledger
      WHERE id = ${result.decision_id}::uuid
    `

    expect(ledgerRows[0]).toMatchObject({
      template_id: 'supplier_loss_v1',
      logical_inference: expect.stringContaining('Estimated cost: €212.50'),
    })

    const radar = await getRadarSnapshot(USER_ID)
    const supplier = radar.supplier_scorecards.find((row) => row.supplier_name === 'Bois & Design')

    expect(supplier).toMatchObject({
      supplier_name: 'Bois & Design',
      total_losses_90d: expect.any(Number),
      recovery_status: 'not_claimed',
    })
    expect(radar.profit_recovery.supplier_recovery_potential_eur).toBeGreaterThanOrEqual(212.5)
  })

  it('lets Leia call declare_supplier_loss when a conversation reports a short delivery', async () => {
    await cleanupSupplierLosses()

    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls += 1

      if (calls === 1) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_supplier_loss',
                      type: 'function',
                      function: {
                        name: 'declare_supplier_loss',
                        arguments: JSON.stringify({
                          supplier_name: 'Bois & Design',
                          sku: 'NRD-CHAIR-012',
                          loss_type: 'delivery_short',
                          quantity: 5,
                          notes: TEST_NOTES,
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: 'assistant',
                content:
                  'Declared the supplier loss. Estimated cost is €212.50. Bois & Design has 1 loss in the last 90 days. Next step: send a claim email.',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })

    const result = await runLeiaToolCallingConversation({
      apiKey: 'test-key',
      model: 'gpt-5.4-mini',
      userId: USER_ID,
      origin: 'http://127.0.0.1:3000',
      messages: [
        {
          role: 'user',
          content:
            'My supplier Bois & Design sent me 45 chairs instead of 50 for NRD-CHAIR-012',
        },
      ],
    })

    expect(result.toolCallsTrace).toHaveLength(1)
    expect(result.toolCallsTrace[0].name).toBe('declare_supplier_loss')
    expect(result.message.content).toContain('Estimated cost is €212.50')
  })
})
