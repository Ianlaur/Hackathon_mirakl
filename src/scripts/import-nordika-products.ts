import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const USER_ID = process.env.HACKATHON_USER_ID
if (!USER_ID) {
  console.error('HACKATHON_USER_ID env var is required')
  process.exit(1)
}

type CatalogRow = {
  product_id: string
  brand: string | null
  title_fr: string | null
  title_en: string | null
  description_fr: string | null
  description_en: string | null
  category_fr: string | null
  price_eur: string | null
}

function parsePrice(raw: string | null): number {
  if (!raw) return 0
  const normalized = raw.replace(',', '.').replace(/[^\d.]/g, '')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

function randomStock(sellingPrice: number): number {
  // Higher-ticket products carry lower stock; lower-ticket products carry deeper stock.
  if (sellingPrice === 0) return 10
  if (sellingPrice >= 500) return Math.floor(Math.random() * 15) + 5
  if (sellingPrice >= 200) return Math.floor(Math.random() * 40) + 10
  return Math.floor(Math.random() * 100) + 20
}

async function main() {
  const rows = await prisma.$queryRaw<CatalogRow[]>`
    SELECT product_id, brand, title_fr, title_en, description_fr, description_en, category_fr, price_eur
    FROM public.data_supplier_catalog_nordika_200
    ORDER BY source_row
  `

  console.log(`Importing ${rows.length} products for user ${USER_ID}`)

  let created = 0
  let updated = 0

  for (const row of rows) {
    const name = row.title_en || row.title_fr || `Product ${row.product_id}`
    const description = row.description_en || row.description_fr || null
    const sellingPrice = parsePrice(row.price_eur)
    const quantity = randomStock(sellingPrice)
    const minQuantity = Math.max(3, Math.ceil(quantity * 0.15))

    const existing = await prisma.product.findFirst({
      where: { user_id: USER_ID, sku: row.product_id },
    })

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name,
          description,
          selling_price: sellingPrice,
          quantity,
          min_quantity: minQuantity,
          active: true,
        },
      })
      updated++
    } else {
      await prisma.product.create({
        data: {
          user_id: USER_ID,
          sku: row.product_id,
          name,
          description,
          selling_price: sellingPrice,
          quantity,
          min_quantity: minQuantity,
          active: true,
        },
      })
      created++
    }
  }

  console.log(`Done: created=${created}, updated=${updated}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
