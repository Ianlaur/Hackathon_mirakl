import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'
import { buildUserProfileUpdate, serializeUserProfile } from '@/lib/profile'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const profileSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide'),
  phone: z.string().max(30).nullish().transform((value) => value || null),
  address: z.string().max(200).nullish().transform((value) => value || null),
  bio: z.string().max(500).nullish().transform((value) => value || null),
  profile_image_url: z
    .string()
    .max(2_000_000)
    .nullish()
    .transform((value) => value || null),
  company_name: z.string().max(100).nullish().transform((value) => value || null),
  company_address: z.string().max(500).nullish().transform((value) => value || null),
  company_siret: z.string().max(20).nullish().transform((value) => value || null),
  company_tva_text: z.string().max(200).nullish().transform((value) => value || null),
  company_logo_url: z
    .string()
    .max(2_000_000)
    .nullish()
    .transform((value) => value || null),
  beta_features_enabled: z.boolean().optional(),
  has_inventory: z.boolean().optional(),
  has_srm: z.boolean().optional(),
})

const userSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  address: true,
  bio: true,
  image: true,
  company_name: true,
  company_address: true,
  company_siret: true,
  company_tva_text: true,
  company_logo_url: true,
  beta_features_enabled: true,
  has_inventory: true,
  has_srm: true,
} as const

type SerializedProfile = ReturnType<typeof serializeUserProfile>

type ProfileOverrideRow = {
  user_id: string
  name: string | null
  email: string | null
  phone: string | null
  address: string | null
  bio: string | null
  profile_image_url: string | null
  company_name: string | null
  company_address: string | null
  company_siret: string | null
  company_tva_text: string | null
  company_logo_url: string | null
  beta_features_enabled: boolean | null
  has_inventory: boolean | null
  has_srm: boolean | null
}

async function ensureProfileOverridesTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.profile_overrides (
      user_id uuid PRIMARY KEY,
      name text,
      email text,
      phone text,
      address text,
      bio text,
      profile_image_url text,
      company_name text,
      company_address text,
      company_siret text,
      company_tva_text text,
      company_logo_url text,
      beta_features_enabled boolean,
      has_inventory boolean,
      has_srm boolean,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

async function getProfileOverride(userId: string) {
  try {
    await ensureProfileOverridesTable()
    const rows = await prisma.$queryRaw<ProfileOverrideRow[]>`
      SELECT
        user_id,
        name,
        email,
        phone,
        address,
        bio,
        profile_image_url,
        company_name,
        company_address,
        company_siret,
        company_tva_text,
        company_logo_url,
        beta_features_enabled,
        has_inventory,
        has_srm
      FROM public.profile_overrides
      WHERE user_id = ${userId}::uuid
      LIMIT 1
    `
    return rows[0] ?? null
  } catch (error) {
    console.error('Error loading profile override:', error)
    return null
  }
}

function mergeProfile(base: SerializedProfile, override: ProfileOverrideRow | null) {
  if (!override) return base

  return {
    ...base,
    name: override.name ?? base.name,
    email: override.email ?? base.email,
    phone: override.phone ?? base.phone,
    address: override.address ?? base.address,
    bio: override.bio ?? base.bio,
    profile_image_url: override.profile_image_url ?? base.profile_image_url,
    company_name: override.company_name ?? base.company_name,
    company_address: override.company_address ?? base.company_address,
    company_siret: override.company_siret ?? base.company_siret,
    company_tva_text: override.company_tva_text ?? base.company_tva_text,
    company_logo_url: override.company_logo_url ?? base.company_logo_url,
    beta_features_enabled: override.beta_features_enabled ?? base.beta_features_enabled,
    has_inventory: override.has_inventory ?? base.has_inventory,
    has_srm: override.has_srm ?? base.has_srm,
  }
}

async function upsertProfileOverride(
  userId: string,
  update: ReturnType<typeof buildUserProfileUpdate>
) {
  await ensureProfileOverridesTable()

  const rows = await prisma.$queryRaw<ProfileOverrideRow[]>`
    INSERT INTO public.profile_overrides (
      user_id,
      name,
      email,
      phone,
      address,
      bio,
      profile_image_url,
      company_name,
      company_address,
      company_siret,
      company_tva_text,
      company_logo_url,
      beta_features_enabled,
      has_inventory,
      has_srm,
      updated_at
    )
    VALUES (
      ${userId}::uuid,
      ${update.name},
      ${update.email},
      ${update.phone},
      ${update.address},
      ${update.bio},
      ${update.image},
      ${update.company_name},
      ${update.company_address},
      ${update.company_siret},
      ${update.company_tva_text},
      ${update.company_logo_url},
      ${'beta_features_enabled' in update ? update.beta_features_enabled ?? null : null},
      ${'has_inventory' in update ? update.has_inventory ?? null : null},
      ${'has_srm' in update ? update.has_srm ?? null : null},
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      bio = EXCLUDED.bio,
      profile_image_url = EXCLUDED.profile_image_url,
      company_name = EXCLUDED.company_name,
      company_address = EXCLUDED.company_address,
      company_siret = EXCLUDED.company_siret,
      company_tva_text = EXCLUDED.company_tva_text,
      company_logo_url = EXCLUDED.company_logo_url,
      beta_features_enabled = EXCLUDED.beta_features_enabled,
      has_inventory = EXCLUDED.has_inventory,
      has_srm = EXCLUDED.has_srm,
      updated_at = NOW()
    RETURNING
      user_id,
      name,
      email,
      phone,
      address,
      bio,
      profile_image_url,
      company_name,
      company_address,
      company_siret,
      company_tva_text,
      company_logo_url,
      beta_features_enabled,
      has_inventory,
      has_srm
  `

  return rows[0]
}

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    })

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    const override = await getProfileOverride(userId)
    return NextResponse.json(mergeProfile(serializeUserProfile(user), override))
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
    const update = buildUserProfileUpdate(data)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    })

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    const override = await upsertProfileOverride(userId, update)
    return NextResponse.json(mergeProfile(serializeUserProfile(user), override))
  } catch (error) {
    console.error('Error updating profile:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Impossible de mettre à jour le profil' }, { status: 500 })
  }
}
