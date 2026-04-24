export type ProfileUpdatePayload = {
  name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  bio?: string | null
  profile_image_url?: string | null
  company_name?: string | null
  company_address?: string | null
  company_siret?: string | null
  company_tva_text?: string | null
  company_logo_url?: string | null
  beta_features_enabled?: boolean
  has_inventory?: boolean
  has_srm?: boolean
}

function normalizeNullableString(value: string | null | undefined) {
  if (!value) return null
  return value
}

export function buildUserProfileUpdate(data: ProfileUpdatePayload) {
  return {
    name: data.name ?? '',
    email: data.email ?? '',
    phone: normalizeNullableString(data.phone),
    address: normalizeNullableString(data.address),
    bio: normalizeNullableString(data.bio),
    image: normalizeNullableString(data.profile_image_url),
    company_name: normalizeNullableString(data.company_name),
    company_address: normalizeNullableString(data.company_address),
    company_siret: normalizeNullableString(data.company_siret),
    company_tva_text: normalizeNullableString(data.company_tva_text),
    company_logo_url: normalizeNullableString(data.company_logo_url),
    ...(typeof data.beta_features_enabled === 'boolean'
      ? { beta_features_enabled: data.beta_features_enabled }
      : {}),
    ...(typeof data.has_inventory === 'boolean'
      ? { has_inventory: data.has_inventory }
      : {}),
    ...(typeof data.has_srm === 'boolean' ? { has_srm: data.has_srm } : {}),
  }
}

export function serializeUserProfile(user: {
  id: string
  email: string | null
  name: string | null
  phone: string | null
  address: string | null
  bio: string | null
  image: string | null
  company_name: string | null
  company_address: string | null
  company_siret: string | null
  company_tva_text: string | null
  company_logo_url: string | null
  beta_features_enabled: boolean
  has_inventory: boolean
  has_srm: boolean
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    address: user.address,
    bio: user.bio,
    profile_image_url: user.image,
    company_name: user.company_name,
    company_address: user.company_address,
    company_siret: user.company_siret,
    company_tva_text: user.company_tva_text,
    company_logo_url: user.company_logo_url,
    beta_features_enabled: user.beta_features_enabled,
    has_inventory: user.has_inventory,
    has_srm: user.has_srm,
  }
}
