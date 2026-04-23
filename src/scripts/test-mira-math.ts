// MIRA — math unit tests. Run via: npm run test:mira-math
// Exits 0 if every calculation matches its expected value.
// Every number that appears in a decision_ledger row must come from tools_math.

import {
  calculateVelocity,
  calculateStockoutDays,
  calculateReorderQty,
  calculateGrowthFactor,
  calculateReturnRate,
  calculateMargin,
  calculateHoursOfStock,
  calculateChannelShares,
} from '../lib/mira/tools_math'

type Check = () => void

const checks: Array<{ name: string; run: Check }> = []
let failed = 0

function test(name: string, run: Check) {
  checks.push({ name, run })
}

function assertEq(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
}

test('calculateVelocity — 14 units over 168h → 2/day, 14/week', () => {
  const v = calculateVelocity([{ quantity: 5 }, { quantity: 9 }], 168)
  assertEq(v.orders, 2, 'orders')
  assertEq(v.units_sold, 14, 'units_sold')
  assertEq(v.units_per_day, 2, 'units_per_day')
  assertEq(v.units_per_week, 14, 'units_per_week')
})

test('calculateVelocity — empty window returns zeros', () => {
  const v = calculateVelocity([], 24)
  assertEq(v.units_sold, 0, 'units_sold')
  assertEq(v.units_per_day, 0, 'units_per_day')
})

test('calculateVelocity — zero-hour window returns zeros not NaN', () => {
  const v = calculateVelocity([{ quantity: 10 }], 0)
  assertEq(v.units_per_day, 0, 'units_per_day')
})

test('calculateStockoutDays — 10 on hand / 2 per day = 5 days', () => {
  assertEq(calculateStockoutDays(10, 2), 5, 'days')
})

test('calculateStockoutDays — zero velocity returns null', () => {
  assertEq(calculateStockoutDays(10, 0), null, 'days')
})

test('calculateReorderQty — velocity 7/wk × (2+2) - 10 on_hand = 18', () => {
  const r = calculateReorderQty(7, 2, 2, 10)
  assertEq(r.demand, 28, 'demand')
  assertEq(r.qty, 18, 'qty')
  assertEq(r.lead_time_weeks, 2, 'lead_time_weeks')
  assertEq(r.buffer_weeks, 2, 'buffer_weeks')
})

test('calculateReorderQty — on_hand exceeds demand → qty 0 not negative', () => {
  const r = calculateReorderQty(5, 1, 1, 50)
  assertEq(r.qty, 0, 'qty')
})

test('calculateGrowthFactor — 200 vs 100 = ×2', () => {
  assertEq(calculateGrowthFactor(200, 100), 2, 'factor')
})

test('calculateGrowthFactor — previous zero returns null', () => {
  assertEq(calculateGrowthFactor(50, 0), null, 'factor')
})

test('calculateReturnRate — 3 returns / 60 orders = 5%', () => {
  assertEq(calculateReturnRate(3, 60), 5, 'rate')
})

test('calculateReturnRate — no orders returns 0 not NaN', () => {
  assertEq(calculateReturnRate(0, 0), 0, 'rate')
})

test('calculateMargin — revenue 100, cost 60 → 40%', () => {
  assertEq(calculateMargin(100, 60), 40, 'margin')
})

test('calculateHoursOfStock — 24 on_hand / 1 per hour = 24h', () => {
  assertEq(calculateHoursOfStock(24, 1), 24, 'hours')
})

test('calculateHoursOfStock — zero velocity returns Infinity', () => {
  assertEq(calculateHoursOfStock(10, 0), Infinity, 'hours')
})

test('calculateChannelShares — 2 channels 70/30 split', () => {
  const rows = [
    { channel: 'a', revenue: 70 },
    { channel: 'b', revenue: 30 },
  ]
  const out = calculateChannelShares(rows)
  assertEq(out[0].share_pct, 70, 'a.share')
  assertEq(out[1].share_pct, 30, 'b.share')
})

for (const c of checks) {
  try {
    c.run()
    console.log(`  ok  ${c.name}`)
  } catch (err) {
    failed += 1
    console.error(`  FAIL  ${c.name}\n         ${(err as Error).message}`)
  }
}

const total = checks.length
console.log(`\nMIRA tools_math: ${total - failed}/${total} passed.`)
process.exit(failed > 0 ? 1 : 0)
