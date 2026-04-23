import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const profileSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide'),
  phone: z.string().max(30).optional().or(z.literal('')).transform((v) => v || null),
  address: z.string().max(200).optional().or(z.literal('')).transform((v) => v || null),
  bio: z.string().max(500).optional().or(z.literal('')).transform((v) => v || null),
  profile_image_url: z
    .string()
    .max(2_000_000) // allow base64 strings, roughly <1.5MB
    .optional()
    .or(z.literal(''))
    .transform((v) => v || null),
  // Business information
  company_name: z.string().max(100).optional().or(z.literal('')).transform((v) => v || null),
  company_address: z.string().max(500).optional().or(z.literal('')).transform((v) => v || null),
  company_siret: z.string().max(20).optional().or(z.literal('')).transform((v) => v || null),
  company_tva_text: z.string().max(200).optional().or(z.literal('')).transform((v) => v || null),
  company_logo_url: z
    .string()
    .max(2_000_000) // allow base64 strings
    .optional()
    .or(z.literal(''))
    .transform((v) => v || null),
  // Beta features
  beta_features_enabled: z.boolean().optional(),
  // Inventory features
  has_inventory: z.boolean().optional(),
  // SRM features
  has_srm: z.boolean().optional(),
})

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const user = await prisma.$queryRaw<any[]>`
      SELECT 
        id, email, name, phone, address, bio, 
        "image" as profile_image_url, company_name, company_address,
        company_siret, company_tva_text, company_logo_url, beta_features_enabled, has_inventory, has_srm
      FROM neon_auth.user
      WHERE id = ${userId}::uuid
      LIMIT 1
    `

    if (!user || user.length === 0) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    return NextResponse.json(user[0])
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json({ error: 'Impossible de récupérer le profil' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    const body = await request.json()
    const data = profileSchema.parse(body)

    // Ensure email uniqueness (except for current user)
    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM neon_auth.user
      WHERE email = ${data.email} AND id != ${userId}::uuid
      LIMIT 1
    `

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'Un utilisateur avec cet email existe déjà' },
        { status: 400 }
      )
    }

    const updated = await prisma.$queryRaw<any[]>`
      UPDATE neon_auth.user
      SET 
        name = ${data.name},
        email = ${data.email},
        phone = ${data.phone},
        address = ${data.address},
        bio = ${data.bio},
        "image" = ${data.profile_image_url},
        company_name = ${data.company_name},
        company_address = ${data.company_address},
        company_siret = ${data.company_siret},
        company_tva_text = ${data.company_tva_text},
        company_logo_url = ${data.company_logo_url},
        beta_features_enabled = COALESCE(${data.beta_features_enabled}, beta_features_enabled),
        has_inventory = COALESCE(${data.has_inventory}, has_inventory),
        has_srm = COALESCE(${data.has_srm}, has_srm),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${userId}::uuid
      RETURNING 
        id, email, name, phone, address, bio,
        "image" as profile_image_url, company_name, company_address,
        company_siret, company_tva_text, company_logo_url, beta_features_enabled, has_inventory, has_srm
    `

    return NextResponse.json(updated[0])
  } catch (error) {
    console.error('Error updating profile:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Impossible de mettre à jour le profil' }, { status: 500 })
  }
}
