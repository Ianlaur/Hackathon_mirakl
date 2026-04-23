import { describe, expect, it } from 'vitest'
import { buildUserProfileUpdate } from '@/lib/profile'

describe('buildUserProfileUpdate', () => {
  it('normalizes empty strings to null while preserving required fields', () => {
    const payload = buildUserProfileUpdate({
      name: 'Jean Charles',
      email: 'jean@example.com',
      phone: '',
      address: '',
      bio: '',
      profile_image_url: '',
      company_name: '',
      company_address: '',
      company_siret: '',
      company_tva_text: '',
      company_logo_url: '',
    })

    expect(payload).toMatchObject({
      name: 'Jean Charles',
      email: 'jean@example.com',
      phone: null,
      address: null,
      bio: null,
      image: null,
      company_name: null,
      company_address: null,
      company_siret: null,
      company_tva_text: null,
      company_logo_url: null,
    })
  })

  it('only includes optional feature flags when they were provided', () => {
    expect(
      buildUserProfileUpdate({
        name: 'Demo',
        email: 'demo@example.com',
        beta_features_enabled: true,
        has_inventory: false,
      })
    ).toMatchObject({
      beta_features_enabled: true,
      has_inventory: false,
    })

    expect(
      buildUserProfileUpdate({
        name: 'Demo',
        email: 'demo@example.com',
      })
    ).not.toHaveProperty('beta_features_enabled')
  })
})
