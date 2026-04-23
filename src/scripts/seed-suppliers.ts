import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SUPPLIERS = [
  { name: 'Scandi Wood Co', lead_time: 7, min_qty: 10, unit_cost_factor: 0.35 },
  { name: 'Oak Mill Atelier', lead_time: 14, min_qty: 5, unit_cost_factor: 0.42 },
  { name: 'Nordic Textile', lead_time: 10, min_qty: 20, unit_cost_factor: 0.28 },
  { name: 'Metal Craft Lyon', lead_time: 5, min_qty: 8, unit_cost_factor: 0.38 },
  { name: 'Shenzhen Furniture Ltd', lead_time: 35, min_qty: 50, unit_cost_factor: 0.22 },
]

async function main() {
  const products = await prisma.product.findMany({ where: { active: true } })
  console.log(`Seeding suppliers on ${products.length} products`)

  for (let index = 0; index < products.length; index++) {
    const product = products[index]
    const supplier = SUPPLIERS[index % SUPPLIERS.length]
    const sellingPrice = Number(product.selling_price)
    const unitCost = Number((sellingPrice * supplier.unit_cost_factor).toFixed(2))

    await prisma.product.update({
      where: { id: product.id },
      data: {
        supplier: supplier.name,
        supplier_lead_time_days: supplier.lead_time,
        supplier_min_order_qty: supplier.min_qty,
        supplier_unit_cost_eur: unitCost,
      },
    })
  }

  console.log('Done seeding suppliers')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
