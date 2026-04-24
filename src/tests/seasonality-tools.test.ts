import { afterEach, describe, expect, it } from 'vitest'

import { executeTool } from '@/lib/mascot-tools'
import { prisma } from '@/lib/prisma'

const USER_ID = process.env.HACKATHON_USER_ID || '00000000-0000-0000-0000-000000000001'
const TEST_SOURCE = 'vitest_seasonal_context'

async function cleanupRecentSeasonalityOrders() {
  await prisma.$executeRaw`
    DELETE FROM public.operational_objects
    WHERE user_id = ${USER_ID}::uuid
      AND raw_payload->>'source' = ${TEST_SOURCE}
  `
}

afterEach(async () => {
  await cleanupRecentSeasonalityOrders()
})

describe('seasonality read tools', () => {
  it('returns observed N-1 Ferragosto patterns from seeded historical orders', async () => {
    const result = (await executeTool(
      'get_seasonal_patterns',
      { event: 'Ferragosto', category: 'lamps' },
      { userId: USER_ID, origin: 'http://127.0.0.1:3000' }
    )) as Record<string, any>

    expect(result.event).toBe('Ferragosto')
    expect(result.region).toBe('IT')
    expect(result.data_source).toBe('observed_n1')
    expect(result.n1_sample_size).toBeGreaterThanOrEqual(20)
    expect(result.growth_factor).toBeGreaterThanOrEqual(1.2)
    expect(result.growth_factor).toBeLessThanOrEqual(1.5)
    expect(result.affected_skus.length).toBeGreaterThan(0)
    expect(result.affected_skus[0]).toEqual(
      expect.objectContaining({
        sku: expect.any(String),
        n1_volume: expect.any(Number),
        projected_demand: expect.any(Number),
      })
    )
  })

  it('applies seasonal context to stockout prediction', async () => {
    await cleanupRecentSeasonalityOrders()

    const product = await prisma.product.findFirst({
      where: { user_id: USER_ID, active: true, quantity: { gt: 0 }, sku: { not: null } },
      select: { sku: true },
      orderBy: { sku: 'asc' },
    })
    expect(product?.sku).toBeTruthy()

    for (let index = 0; index < 4; index += 1) {
      await prisma.$executeRaw`
        INSERT INTO public.operational_objects (
          user_id,
          source_channel,
          kind,
          external_id,
          sku,
          status,
          quantity,
          amount_cents,
          currency,
          occurred_at,
          ingested_at,
          raw_payload
        ) VALUES (
          ${USER_ID}::uuid,
          'amazon_it',
          'order',
          ${`${TEST_SOURCE}-${index}`},
          ${product!.sku},
          'shipped',
          2,
          12000,
          'EUR',
          now() - (${index}::int * INTERVAL '6 hours'),
          now(),
          ${{
            source: TEST_SOURCE,
            channel: 'amazon_it',
            QuantityOrdered: 2,
          }}::jsonb
        )
      `
    }

    const normal = (await executeTool(
      'predict_stockout',
      { sku: product!.sku },
      { userId: USER_ID, origin: 'http://127.0.0.1:3000' }
    )) as Record<string, any>

    const seasonal = (await executeTool(
      'predict_stockout',
      {
        sku: product!.sku,
        seasonal_context: {
          event_name: 'Ferragosto',
          growth_factor: 1.34,
        },
      },
      { userId: USER_ID, origin: 'http://127.0.0.1:3000' }
    )) as Record<string, any>

    expect(seasonal.context).toBe('Ferragosto')
    expect(seasonal.current_velocity_per_day).toBe(normal.current_velocity_per_day)
    expect(seasonal.projected_velocity_per_day).toBeGreaterThan(normal.projected_velocity_per_day)
    expect(seasonal.days_remaining).toBeLessThan(normal.days_remaining)
  })
})
