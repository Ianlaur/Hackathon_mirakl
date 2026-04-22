import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const userId = process.env.HACKATHON_USER_ID || '00000000-0000-0000-0000-000000000001'
  const email = process.env.SEED_USER_EMAIL || 'demo@lauria.local'
  const name = process.env.SEED_USER_NAME || 'Demo Lauria'
  const password = process.env.SEED_USER_PASSWORD || 'password123'

  const user = await prisma.user.upsert({
    where: { id: userId },
    update: {
      email,
      name,
      has_inventory: true,
    },
    create: {
      id: userId,
      email,
      name,
      has_inventory: true,
    },
  })

  await prisma.account.upsert({
    where: {
      userId_providerId: {
        userId: user.id,
        providerId: 'credential',
      },
    },
    update: {
      password: await bcrypt.hash(password, 10),
    },
    create: {
      userId: user.id,
      providerId: 'credential',
      password: await bcrypt.hash(password, 10),
    },
  })

  console.log(`Seeded user ${email} (${user.id})`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
