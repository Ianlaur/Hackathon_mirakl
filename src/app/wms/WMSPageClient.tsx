'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Zone {
  id: string
  name: string
  code: string
  description: string | null
  zone_type: string
  color: string | null
  bins: Bin[]
  _count: { bins: number }
}

interface Bin {
  id: string
  name: string
  code: string
  barcode: string | null
  capacity: number | null
  current_usage: number
  zone: { id: string; name: string; code: string; color: string | null }
  bin_contents: BinContent[]
  _count: { bin_contents: number }
}

interface BinContent {
  id: string
  product_id: string
  quantity: number
}

interface PickingList {
  id: string
  reference: string
  status: string
  priority: number
  notes: string | null
  assigned_to: string | null
  created_at: string
  picking_tasks: PickingTask[]
  _count: { picking_tasks: number }
}

interface PickingTask {
  id: string
  product_id: string
  quantity_ordered: number
  quantity_picked: number
  status: string
}

interface Product {
  id: string
  name: string
  sku: string | null
  quantity: number
}

interface Stats {
  totalZones: number
  totalBins: number
  activePicking: number
  pendingPicking: number
}

const ZONE_TYPES: Record<string, { label: string; color: string }> = {
  receiving: { label: 'Réception', color: 'bg-blue-100 text-blue-700' },
  storage: { label: 'Stockage', color: 'bg-gray-100 text-gray-700' },
  picking: { label: 'Picking', color: 'bg-green-100 text-green-700' },
  shipping: { label: 'Expédition', color: 'bg-purple-100 text-purple-700' },
  returns: { label: 'Retours', color: 'bg-orange-100 text-orange-700' },
  quarantine: { label: 'Quarantaine', color: 'bg-red-100 text-red-700' },
}

export default function WMSPageClient({
  zones,
  bins,
  pickingLists,
  products,
  stats
}: {
  zones: Zone[]
  bins: Bin[]
  pickingLists: PickingList[]
  products: Product[]
  stats: Stats
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'overview' | 'zones' | 'bins' | 'products' | 'picking'>('overview')
  const [showZoneModal, setShowZoneModal] = useState(false)
  const [showBinModal, setShowBinModal] = useState(false)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [editingBin, setEditingBin] = useState<Bin | null>(null)
  const [saving, setSaving] = useState(false)

  // Zone form state
  const [zoneForm, setZoneForm] = useState({
    name: '',
    code: '',
    description: '',
    zone_type: 'storage',
    color: '#6366f1',
  })

  // Bin form state
  const [binForm, setBinForm] = useState({
    zone_id: '',
    name: '',
    code: '',
    barcode: '',
    capacity: '',
  })

  const handleCreateZone = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/wms/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zoneForm)
      })
      if (res.ok) {
        setShowZoneModal(false)
        setZoneForm({ name: '', code: '', description: '', zone_type: 'storage', color: '#6366f1' })
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateZone = async () => {
    if (!editingZone) return
    setSaving(true)
    try {
      const res = await fetch(`/api/wms/zones/${editingZone.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zoneForm)
      })
      if (res.ok) {
        setEditingZone(null)
        setShowZoneModal(false)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm('Supprimer cette zone et tous ses emplacements ?')) return
    try {
      const res = await fetch(`/api/wms/zones/${zoneId}`, { method: 'DELETE' })
      if (res.ok) router.refresh()
    } catch (error) {
      console.error('Error deleting zone:', error)
    }
  }

  const handleCreateBin = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/wms/bins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...binForm,
          capacity: binForm.capacity ? parseInt(binForm.capacity) : null,
        })
      })
      if (res.ok) {
        setShowBinModal(false)
        setBinForm({ zone_id: '', name: '', code: '', barcode: '', capacity: '' })
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateBin = async () => {
    if (!editingBin) return
    setSaving(true)
    try {
      const res = await fetch(`/api/wms/bins/${editingBin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...binForm,
          capacity: binForm.capacity ? parseInt(binForm.capacity) : null,
        })
      })
      if (res.ok) {
        setEditingBin(null)
        setShowBinModal(false)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteBin = async (binId: string) => {
    if (!confirm('Supprimer cet emplacement ?')) return
    try {
      const res = await fetch(`/api/wms/bins/${binId}`, { method: 'DELETE' })
      if (res.ok) router.refresh()
    } catch (error) {
      console.error('Error deleting bin:', error)
    }
  }

  const openEditZone = (zone: Zone) => {
    setEditingZone(zone)
    setZoneForm({
      name: zone.name,
      code: zone.code,
      description: zone.description || '',
      zone_type: zone.zone_type,
      color: zone.color || '#6366f1',
    })
    setShowZoneModal(true)
  }

  const openEditBin = (bin: Bin) => {
    setEditingBin(bin)
    setBinForm({
      zone_id: bin.zone.id,
      name: bin.name,
      code: bin.code,
      barcode: bin.barcode || '',
      capacity: bin.capacity?.toString() || '',
    })
    setShowBinModal(true)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Gestion d'entrepôt
            <span className="ml-3 text-sm font-normal px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">WMS</span>
          </h1>
          <p className="text-gray-500 mt-1">Zones, emplacements et préparation de commandes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingZone(null); setZoneForm({ name: '', code: '', description: '', zone_type: 'storage', color: '#6366f1' }); setShowZoneModal(true) }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouvelle zone
          </button>
          <button
            onClick={() => { setEditingBin(null); setBinForm({ zone_id: zones[0]?.id || '', name: '', code: '', barcode: '', capacity: '' }); setShowBinModal(true) }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
            disabled={zones.length === 0}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouvel emplacement
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalZones}</div>
              <div className="text-sm text-gray-500">Zones</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalBins}</div>
              <div className="text-sm text-gray-500">Emplacements</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.pendingPicking}</div>
              <div className="text-sm text-gray-500">Picking en attente</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.activePicking}</div>
              <div className="text-sm text-gray-500">Picking en cours</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        {(['overview', 'zones', 'bins', 'products', 'picking'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'overview' && 'Vue d\'ensemble'}
            {tab === 'zones' && 'Zones'}
            {tab === 'bins' && 'Emplacements'}
            {tab === 'products' && 'Produits → Emplacements'}
            {tab === 'picking' && 'Picking'}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Zones Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Zones d'entrepôt</h3>
            {zones.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>Aucune zone configurée</p>
                <button
                  onClick={() => setShowZoneModal(true)}
                  className="mt-3 text-indigo-600 hover:underline"
                >
                  Créer votre première zone
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {zones.map(zone => (
                  <div
                    key={zone.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ backgroundColor: `${zone.color}20`, color: zone.color || '#6366f1' }}
                      >
                        {zone.code.substring(0, 2)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{zone.name}</div>
                        <div className="text-xs text-gray-500">{zone.code} • {zone._count.bins} emplacements</div>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${ZONE_TYPES[zone.zone_type]?.color || 'bg-gray-100'}`}>
                      {ZONE_TYPES[zone.zone_type]?.label || zone.zone_type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Picking Lists */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Préparations en cours</h3>
            {pickingLists.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>Aucune préparation en attente</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pickingLists.map(pl => (
                  <div
                    key={pl.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{pl.reference}</div>
                      <div className="text-xs text-gray-500">
                        {pl._count.picking_tasks} articles • 
                        {pl.picking_tasks.filter(t => t.status === 'completed').length} préparés
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      pl.status === 'in_progress' 
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {pl.status === 'in_progress' ? 'En cours' : 'En attente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zones Tab */}
      {activeTab === 'zones' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Zone</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Code</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Type</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Emplacements</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zones.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    Aucune zone configurée
                  </td>
                </tr>
              ) : (
                zones.map(zone => (
                  <tr key={zone.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: zone.color || '#6366f1' }}
                        />
                        <span className="font-medium text-gray-900">{zone.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 font-mono text-sm">{zone.code}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${ZONE_TYPES[zone.zone_type]?.color || 'bg-gray-100'}`}>
                        {ZONE_TYPES[zone.zone_type]?.label || zone.zone_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">{zone._count.bins}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditZone(zone)}
                          className="p-2 text-gray-400 hover:text-indigo-600 transition"
                          title="Modifier"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteZone(zone.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition"
                          title="Supprimer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bins Tab */}
      {activeTab === 'bins' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Emplacement</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Code</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Zone</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Produits</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Capacité</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    Aucun emplacement configuré
                  </td>
                </tr>
              ) : (
                bins.map(bin => (
                  <tr key={bin.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{bin.name}</td>
                    <td className="py-3 px-4 text-gray-600 font-mono text-sm">{bin.code}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: bin.zone.color || '#6366f1' }}
                        />
                        <span className="text-gray-600">{bin.zone.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">{bin._count.bin_contents}</td>
                    <td className="py-3 px-4 text-center text-gray-600">
                      {bin.capacity ? `${bin.current_usage}/${bin.capacity}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditBin(bin)}
                          className="p-2 text-gray-400 hover:text-indigo-600 transition"
                          title="Modifier"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteBin(bin.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition"
                          title="Supprimer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Products to Locations Tab */}
      {activeTab === 'products' && (
        <ProductLocationsTab products={products} bins={bins} />
      )}

      {/* Picking Tab */}
      {activeTab === 'picking' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="text-center py-8 text-gray-400">
            <h3 className="text-lg font-medium text-gray-600 mb-2">Préparation de commandes</h3>
            <p className="text-sm">La fonctionnalité de picking sera bientôt disponible.</p>
            <p className="text-sm mt-1">Créez vos zones et emplacements pour commencer.</p>
          </div>
        </div>
      )}

      {/* Zone Modal */}
      {showZoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {editingZone ? 'Modifier la zone' : 'Nouvelle zone'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input
                  type="text"
                  value={zoneForm.name}
                  onChange={e => setZoneForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Zone A - Stockage principal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={zoneForm.code}
                  onChange={e => setZoneForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                  placeholder="ZONE-A"
                  maxLength={20}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={zoneForm.zone_type}
                  onChange={e => setZoneForm(f => ({ ...f, zone_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {Object.entries(ZONE_TYPES).map(([value, { label }]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Couleur</label>
                <input
                  type="color"
                  value={zoneForm.color}
                  onChange={e => setZoneForm(f => ({ ...f, color: e.target.value }))}
                  className="w-full h-10 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optionnel)</label>
                <textarea
                  value={zoneForm.description}
                  onChange={e => setZoneForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={2}
                  placeholder="Description de la zone..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowZoneModal(false); setEditingZone(null) }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
              >
                Annuler
              </button>
              <button
                onClick={editingZone ? handleUpdateZone : handleCreateZone}
                disabled={saving || !zoneForm.name || !zoneForm.code}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : (editingZone ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bin Modal */}
      {showBinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              {editingBin ? 'Modifier l\'emplacement' : 'Nouvel emplacement'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                <select
                  value={binForm.zone_id}
                  onChange={e => setBinForm(f => ({ ...f, zone_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Sélectionner une zone</option>
                  {zones.map(zone => (
                    <option key={zone.id} value={zone.id}>{zone.name} ({zone.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input
                  type="text"
                  value={binForm.name}
                  onChange={e => setBinForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Étagère 1 - Niveau 2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={binForm.code}
                  onChange={e => setBinForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                  placeholder="A-01-02"
                  maxLength={30}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code-barres (optionnel)</label>
                <input
                  type="text"
                  value={binForm.barcode}
                  onChange={e => setBinForm(f => ({ ...f, barcode: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                  placeholder="LOC-A-01-02"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacité (optionnel)</label>
                <input
                  type="number"
                  value={binForm.capacity}
                  onChange={e => setBinForm(f => ({ ...f, capacity: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="100"
                  min="1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowBinModal(false); setEditingBin(null) }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
              >
                Annuler
              </button>
              <button
                onClick={editingBin ? handleUpdateBin : handleCreateBin}
                disabled={saving || !binForm.name || !binForm.code || !binForm.zone_id}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : (editingBin ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Product Locations Tab Component
function ProductLocationsTab({ products, bins }: { products: Product[]; bins: Bin[] }) {
  const router = useRouter()
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedBin, setSelectedBin] = useState('')
  const [quantity, setQuantity] = useState('')
  const [saving, setSaving] = useState(false)
  const [binContents, setBinContents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Load bin contents on mount
  useEffect(() => {
    fetch('/api/wms/bin-contents')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setBinContents(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleAssign = async () => {
    if (!selectedProduct || !selectedBin || !quantity) return
    setSaving(true)
    try {
      const res = await fetch('/api/wms/bin-contents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          bin_id: selectedBin,
          quantity: parseInt(quantity)
        })
      })
      if (res.ok) {
        setShowAssignModal(false)
        setSelectedProduct(null)
        setSelectedBin('')
        setQuantity('')
        // Refresh data
        const newData = await fetch('/api/wms/bin-contents').then(r => r.json())
        if (Array.isArray(newData)) setBinContents(newData)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (binId: string, productId: string) => {
    if (!confirm('Retirer ce produit de cet emplacement ?')) return
    try {
      const res = await fetch(`/api/wms/bin-contents?binId=${binId}&productId=${productId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setBinContents(prev => prev.filter(bc => !(bc.bin_id === binId && bc.product_id === productId)))
        router.refresh()
      }
    } catch (error) {
      console.error('Error removing bin content:', error)
    }
  }

  // Group bin contents by product
  const productLocations = products.map(product => {
    const locations = binContents.filter(bc => bc.product_id === product.id)
    const totalInBins = locations.reduce((sum, loc) => sum + loc.quantity, 0)
    return { ...product, locations, totalInBins }
  })

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <div className="text-2xl">💡</div>
        <div>
          <h4 className="font-semibold text-blue-900">Lier vos produits aux emplacements</h4>
          <p className="text-sm text-blue-700 mt-1">
            Assignez vos produits du stock à des emplacements spécifiques dans votre entrepôt pour un meilleur suivi.
          </p>
        </div>
      </div>

      {/* Products list with locations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Produits et leurs emplacements</h3>
          <span className="text-sm text-gray-500">{products.length} produits</span>
        </div>
        
        {products.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>Aucun produit dans le stock.</p>
            <p className="text-sm mt-1">Ajoutez des produits dans la page Stock pour commencer.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {productLocations.map(product => (
              <div key={product.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-gray-900">{product.name}</h4>
                      {product.sku && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {product.sku}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Stock total: <span className="font-medium text-gray-700">{product.quantity}</span>
                      {product.totalInBins > 0 && (
                        <span className="ml-3 text-emerald-600">
                          • {product.totalInBins} en entrepôt
                        </span>
                      )}
                      {product.quantity > product.totalInBins && (
                        <span className="ml-3 text-amber-600">
                          • {product.quantity - product.totalInBins} non assigné
                        </span>
                      )}
                    </div>
                    
                    {/* Locations */}
                    {product.locations.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {product.locations.map((loc: any) => (
                          <div
                            key={loc.id}
                            className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-sm"
                          >
                            <span className="font-medium">
                              {loc.bin?.zone?.name} / {loc.bin?.code}
                            </span>
                            <span className="text-indigo-500">×{loc.quantity}</span>
                            <button
                              onClick={() => handleRemove(loc.bin_id, loc.product_id)}
                              className="ml-1 text-indigo-400 hover:text-red-500 transition"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={() => {
                      setSelectedProduct(product)
                      setShowAssignModal(true)
                    }}
                    className="ml-4 px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition flex items-center gap-1"
                  >
                    <span>+</span> Assigner
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Assigner à un emplacement
            </h3>
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="font-medium text-gray-900">{selectedProduct.name}</div>
              {selectedProduct.sku && (
                <div className="text-sm text-gray-500">SKU: {selectedProduct.sku}</div>
              )}
              <div className="text-sm text-gray-500">Stock disponible: {selectedProduct.quantity}</div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Emplacement</label>
                <select
                  value={selectedBin}
                  onChange={(e) => setSelectedBin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">Sélectionner un emplacement...</option>
                  {bins.map(bin => (
                    <option key={bin.id} value={bin.id}>
                      {bin.zone?.name} / {bin.code} - {bin.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Quantité à placer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAssignModal(false)
                  setSelectedProduct(null)
                  setSelectedBin('')
                  setQuantity('')
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleAssign}
                disabled={saving || !selectedBin || !quantity}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Assigner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
