'use client'

import { useEffect, useState, ChangeEvent, FormEvent } from 'react'
import Image from 'next/image'

type Profile = {
  name: string
  email: string
  phone?: string | null
  address?: string | null
  bio?: string | null
  profile_image_url?: string | null
  // Business information
  company_name?: string | null
  company_address?: string | null
  company_siret?: string | null
  company_tva_text?: string | null
  company_logo_url?: string | null
  // Features
  beta_features_enabled?: boolean
  has_inventory?: boolean
}

const emptyProfile: Profile = {
  name: '',
  email: '',
  phone: '',
  address: '',
  bio: '',
  profile_image_url: '',
  company_name: '',
  company_address: '',
  company_siret: '',
  company_tva_text: '',
  company_logo_url: '',
  beta_features_enabled: false,
  has_inventory: false,
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState<string | null>(null)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const profileRes = await fetch('/api/profile')

        if (!profileRes.ok) {
          throw new Error('Impossible de charger votre profil')
        }

        const profileData = await profileRes.json()
        setProfile({
          name: profileData.name || '',
          email: profileData.email || '',
          phone: profileData.phone || '',
          address: profileData.address || '',
          bio: profileData.bio || '',
          profile_image_url: profileData.profile_image_url || '',
          company_name: profileData.company_name || '',
          company_address: profileData.company_address || '',
          company_siret: profileData.company_siret || '',
          company_tva_text: profileData.company_tva_text || '',
          company_logo_url: profileData.company_logo_url || '',
          beta_features_enabled: profileData.beta_features_enabled || false,
          has_inventory: profileData.has_inventory || false,
        })
        setPreview(profileData.profile_image_url || null)
        setLogoPreview(profileData.company_logo_url || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleChange = (field: keyof Profile) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setProfile((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 1.5 * 1024 * 1024) {
      setError('Image trop lourde (max 1.5MB)')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result?.toString() || ''
      setPreview(base64)
      setProfile((prev) => ({ ...prev, profile_image_url: base64 }))
    }
    reader.readAsDataURL(file)
  }

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 1.5 * 1024 * 1024) {
      setError('Logo trop lourd (max 1.5MB)')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result?.toString() || ''
      setLogoPreview(base64)
      setProfile((prev) => ({ ...prev, company_logo_url: base64 }))
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Échec de la mise à jour')
      }
      setSuccess('Profil mis à jour')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(null)

    if (pwNew.length < 8) {
      setPwError('Le nouveau mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (pwNew !== pwConfirm) {
      setPwError('Les mots de passe ne correspondent pas')
      return
    }

    setPwSaving(true)
    try {
      const res = await fetch('/api/profile/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: pwCurrent, new_password: pwNew }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Échec de la mise à jour du mot de passe')
      }
      setPwSuccess('Mot de passe mis à jour')
      setPwCurrent('')
      setPwNew('')
      setPwConfirm('')
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setPwSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="h-10 w-48 bg-gray-200 rounded animate-pulse mb-6"></div>
        <div className="grid gap-4">
          <div className="h-32 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-gray-500">Paramètres</p>
          <h1 className="text-3xl font-bold text-gray-900">Mon profil</h1>
          <p className="text-gray-500 mt-1">Mettez à jour vos informations personnelles</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}

        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="relative w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
              {preview ? (
                <Image src={preview} alt="Avatar" fill sizes="80px" className="object-cover" />
              ) : (
                profile.name?.[0]?.toUpperCase() || '?'
              )}
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">Photo de profil</p>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-indigo-700 transition">
                Changer
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
              </label>
              {preview && (
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null)
                    setProfile((prev) => ({ ...prev, profile_image_url: '' }))
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Supprimer
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">PNG/JPG, max 1.5MB</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nom complet</label>
            <input
              type="text"
              value={profile.name}
              onChange={handleChange('name')}
              required
              className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={profile.email}
              onChange={handleChange('email')}
              required
              className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone (optionnel)</label>
            <input
              type="tel"
              value={profile.phone || ''}
              onChange={handleChange('phone')}
              placeholder="+33 6 12 34 56 78"
              className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Adresse (optionnel)</label>
            <input
              type="text"
              value={profile.address || ''}
              onChange={handleChange('address')}
              placeholder="12 rue Exemple, 75000 Paris"
              className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Autres infos (bio, note)</label>
          <textarea
            value={profile.bio || ''}
            onChange={handleChange('bio')}
            rows={4}
            className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            placeholder="Parlez brièvement de vous ou ajoutez une note interne."
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer les changements'}
          </button>
        </div>
      </form>

      {/* Business Information Section */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6 mt-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Informations entreprise
          </h2>
          <p className="text-sm text-gray-500 mt-1">Ces informations apparaîtront sur vos factures et devis</p>
        </div>

        {/* Company Logo */}
        <div className="flex items-start gap-6">
          <div className="flex-shrink-0">
            <p className="text-sm font-medium text-gray-700 mb-2">Logo entreprise</p>
            <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
              {logoPreview ? (
                <Image src={logoPreview} alt="Logo" width={128} height={128} className="object-contain w-full h-full" />
              ) : (
                <div className="text-center p-4">
                  <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs text-gray-500">Aucun logo</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <label className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg cursor-pointer hover:bg-indigo-700 transition">
                Changer
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>
              {logoPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setLogoPreview(null)
                    setProfile((prev) => ({ ...prev, company_logo_url: '' }))
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Supprimer
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">PNG/JPG, max 1.5MB</p>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nom de l&apos;entreprise</label>
              <input
                type="text"
                value={profile.company_name || ''}
                onChange={handleChange('company_name')}
                placeholder="Mon Entreprise SARL"
                className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">SIRET</label>
              <input
                type="text"
                value={profile.company_siret || ''}
                onChange={handleChange('company_siret')}
                placeholder="123 456 789 00012"
                className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Adresse de l&apos;entreprise</label>
          <textarea
            value={profile.company_address || ''}
            onChange={handleChange('company_address')}
            rows={2}
            placeholder="7 rue François Mitterrand&#10;18100 Vierzon, France"
            className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Mention TVA</label>
          <input
            type="text"
            value={profile.company_tva_text || ''}
            onChange={handleChange('company_tva_text')}
            placeholder="TVA non applicable, art. 293 B du CGI"
            className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">Laissez vide si vous êtes assujetti à la TVA</p>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer les changements'}
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4 mt-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Sécurité</h2>
          <p className="text-sm text-gray-500">Mettre à jour votre mot de passe</p>
        </div>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          {pwError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {pwSuccess}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mot de passe actuel</label>
              <input
                type="password"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
                required
                className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau mot de passe</label>
              <input
                type="password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                required
                className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirmer</label>
              <input
                type="password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                required
                className="w-full px-3 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pwSaving}
              className="px-5 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
            >
              {pwSaving ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
            </button>
          </div>
        </form>
      </div>

      {/* Beta Features Section */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 shadow-sm p-6 space-y-4 mt-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 rounded-xl">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">Fonctionnalités Beta</h2>
            <p className="text-sm text-gray-600 mt-1">
              Accédez en avant-première aux nouvelles fonctionnalités en cours de développement.
              Ces fonctionnalités peuvent être instables ou changer sans préavis.
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-amber-100">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <div>
                <p className="font-medium text-gray-900">Activer les fonctionnalités beta</p>
                <p className="text-sm text-gray-500">
                  Inclut : Suivi des dépenses, et plus à venir...
                </p>
              </div>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={profile.beta_features_enabled || false}
                onChange={(e) => {
                  const newValue = e.target.checked
                  setProfile(prev => ({ ...prev, beta_features_enabled: newValue }))
                  // Auto-save beta setting
                  fetch('/api/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...profile, beta_features_enabled: newValue }),
                  }).then(() => {
                    setSuccess(newValue ? 'Fonctionnalités beta activées ! Rechargez la page pour voir les changements.' : 'Fonctionnalités beta désactivées.')
                    setTimeout(() => setSuccess(null), 5000)
                  })
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </div>
          </label>
        </div>

        {profile.beta_features_enabled && (
          <div className="bg-amber-100/50 rounded-lg p-3 flex items-center gap-2 text-sm text-amber-800">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Vous avez accès aux fonctionnalités beta. Vos retours sont les bienvenus !</span>
          </div>
        )}
      </div>

      {/* Inventory & Stock Management Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm p-6 space-y-4 mt-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 rounded-xl">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">Gestion de Stock & Entrepôt</h2>
            <p className="text-sm text-gray-600 mt-1">
              Activez les fonctionnalités de gestion de stock et d&apos;entrepôt (WMS) pour votre activité commerciale.
            </p>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-4 border border-blue-100">
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-3">
              <div>
                <p className="font-medium text-gray-900">Activer la gestion de stock</p>
                <p className="text-sm text-gray-500">
                  Inclut : Stock produits, Entrepôt (WMS), Zones, Emplacements, Listes de picking
                </p>
              </div>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={profile.has_inventory || false}
                onChange={(e) => {
                  const newValue = e.target.checked
                  setProfile(prev => ({ ...prev, has_inventory: newValue }))
                  // Auto-save inventory setting
                  fetch('/api/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...profile, has_inventory: newValue }),
                  }).then(() => {
                    setSuccess(newValue ? 'Gestion de stock activée ! Rechargez la page pour voir les menus.' : 'Gestion de stock désactivée.')
                    setTimeout(() => setSuccess(null), 5000)
                  })
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </div>
          </label>
        </div>

        {profile.has_inventory && (
          <div className="bg-blue-100/50 rounded-lg p-3 flex items-center gap-2 text-sm text-blue-800">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Les menus Stock et Entrepôt sont maintenant visibles dans la barre latérale.</span>
          </div>
        )}
      </div>
    </div>
  )
}
