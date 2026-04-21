import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Mot de passe actuel requis'),
  new_password: z.string().min(8, 'Le nouveau mot de passe doit contenir au moins 8 caractères'),
})

export async function PUT(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    const data = passwordSchema.parse(body)

    // Get password from neon_auth.account
    const account = await prisma.$queryRaw<any[]>`
      SELECT password
      FROM neon_auth.account
      WHERE \"userId\" = ${userId}::uuid AND \"providerId\" = 'credential'
      LIMIT 1
    `

    if (!account || account.length === 0 || !account[0].password) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    const isValid = await bcrypt.compare(data.current_password, account[0].password)
    if (!isValid) {
      return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 400 })
    }

    const newHash = await bcrypt.hash(data.new_password, 10)
    await prisma.$executeRaw`
      UPDATE neon_auth.account
      SET password = ${newHash}, \"updatedAt\" = CURRENT_TIMESTAMP
      WHERE \"userId\" = ${userId}::uuid AND \"providerId\" = 'credential'
    `

    return NextResponse.json({ message: 'Mot de passe mis à jour' })
  } catch (error) {
    console.error('Error updating password:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Impossible de mettre à jour le mot de passe' }, { status: 500 })
  }
}
