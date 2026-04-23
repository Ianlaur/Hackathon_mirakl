'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface Product {
  id: string
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
  purchase_price: number | null
  selling_price: number
  quantity: number
  min_quantity: number
  unit: string
  location: string | null
  supplier: string | null
  image_url: string | null
  category: {
    id: string
    name: string
    color: string | null
  } | null
  _count: { stock_movements: number }
}

interface Category {
  id: string
  name: string
  color: string | null
  icon: string | null
  _count: { products: number }
}

interface StockMovement {
  id: string
  type: string
  quantity: number
  unit_price: number | null
  reference: string | null
  notes: string | null
  created_at: string
  products: { id: string; name: string; sku: string | null }
}

interface Stats {
  totalProducts: number
  totalValue: number
  lowStockCount: number
  outOfStockCount: number
}

const MOVEMENT_TYPES = {
  purchase: { label: 'Achat', icon: '+', color: 'text-green-600 bg-green-50' },
  sale: { label: 'Vente', icon: '-', color: 'text-blue-600 bg-blue-50' },
  return_in: { label: 'Retour client', icon: '←', color: 'text-purple-600 bg-purple-50' },
  return_out: { label: 'Retour fournisseur', icon: '→', color: 'text-orange-600 bg-orange-50' },
  adjustment: { label: 'Ajustement', icon: '±', color: 'text-gray-600 bg-gray-50' },
  transfer: { label: 'Transfert', icon: '⇄', color: 'text-indigo-600 bg-indigo-50' },
  loss: { label: 'Perte', icon: '×', color: 'text-red-600 bg-red-50' },
  initial: { label: 'Stock initial', icon: '○', color: 'text-teal-600 bg-teal-50' },
}

export default function StockPageClient({
  products,
  categories,
  recentMovements,
  stats
}: {
  products: Product[]
  categories: Category[]
  recentMovements: StockMovement[]
  stats: Stats
}) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showLowStock, setShowLowStock] = useState(false)
  const [showNewProductModal, setShowNewProductModal] = useState(false)
  const [showStockModal, setShowStockModal] = useState<string | null>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Delete product handler
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer "${productName}" ?`)) {
      return
    }
    
    setDeletingId(productId)
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        router.refresh()
      } else {
        alert('Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Erreur lors de la suppression')
    } finally {
      setDeletingId(null)
    }
  }

  // Delete all products and categories handler
  const handleDeleteAll = async () => {
    if (products.length === 0 && categories.length === 0) {
      alert('Aucun produit ou catégorie à supprimer')
      return
    }
    
    const confirmation = prompt(
      `Êtes-vous sûr de vouloir supprimer TOUS les ${products.length} produits et ${categories.length} catégories ?\n\nCette action est irréversible.\n\nTapez "SUPPRIMER" pour confirmer:`
    )
    
    if (confirmation !== 'SUPPRIMER') {
      return
    }
    
    try {
      const response = await fetch('/api/products/delete-all', {
        method: 'DELETE'
      })
      
      if (response.ok) {
        const data = await response.json()
        alert(`${data.deleted} produit(s) et ${data.categoriesDeleted || 0} catégorie(s) supprimé(s)`)
        router.refresh()
      } else {
        alert('Erreur lors de la suppression')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Erreur lors de la suppression')
    }
  }

  // Export products to CSV
  const handleExportCSV = () => {
    const headers = ['Nom', 'SKU', 'Code-barres', 'Description', 'Catégorie', 'Prix achat', 'Prix vente', 'Quantité', 'Stock min', 'Unité', 'Emplacement', 'Fournisseur']
    const rows = products.map(p => [
      p.name,
      p.sku || '',
      p.barcode || '',
      p.description || '',
      p.category?.name || '',
      p.purchase_price?.toString() || '',
      p.selling_price.toString(),
      p.quantity.toString(),
      p.min_quantity.toString(),
      p.unit,
      p.location || '',
      p.supplier || ''
    ])
    
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';'))
    ].join('\n')
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `stock_export_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Export products to JSON
  const handleExportJSON = () => {
    const exportData = products.map(p => ({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      description: p.description,
      category: p.category?.name || null,
      purchase_price: p.purchase_price,
      selling_price: p.selling_price,
      quantity: p.quantity,
      min_quantity: p.min_quantity,
      unit: p.unit,
      location: p.location,
      supplier: p.supplier
    }))
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `stock_export_${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchQuery || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesCategory = !selectedCategory || p.category?.id === selectedCategory
    const matchesLowStock = !showLowStock || p.quantity <= p.min_quantity

    return matchesSearch && matchesCategory && matchesLowStock
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-[22px] font-bold tracking-tight text-[#03182F]">Stock</h1>
          <p className="font-serif text-[13px] text-[#6B7480] mt-1 italic">{stats.totalProducts} produits en stock</p>
        </div>
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {/* Import/Export Dropdown */}
              <div className="relative group">
                <button className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="hidden sm:inline">Import/Export</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-gray-700 hover:bg-gray-50 rounded-t-xl"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Importer (CSV/JSON)
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-gray-700 hover:bg-gray-50"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exporter CSV
                  </button>
                  <button
                    onClick={handleExportJSON}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-gray-700 hover:bg-gray-50"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    Exporter JSON
                  </button>
                  <div className="border-t border-gray-100"></div>
                  <button
                    onClick={handleDeleteAll}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-red-600 hover:bg-red-50 rounded-b-xl"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Tout supprimer
                  </button>
                </div>
              </div>
              
              <button
                onClick={() => setShowNewProductModal(true)}
                className="h-9 px-4 bg-[#004bd9] text-white font-serif text-[13px] font-bold rounded hover:bg-[#004bd9]/90 transition-colors flex items-center gap-2 shadow-sm"
              >
                <span className="text-sm">+</span>
                Nouveau produit
              </button>
        </div>
      </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 border border-[#DDE5EE] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
            <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#30373E] uppercase block mb-2">TOTAL PRODUITS</span>
            <span className="font-serif text-[44px] font-bold leading-none tracking-tight text-[#004bd9]">{stats.totalProducts}</span>
          </div>
          <div className="bg-white p-6 border border-[#DDE5EE] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
            <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#30373E] uppercase block mb-2">VALEUR STOCK</span>
            <span className="font-serif text-[44px] font-bold leading-none tracking-tight text-[#03182F]">{stats.totalValue.toLocaleString('fr-FR')}€</span>
          </div>
          <div className="bg-white p-6 border border-[#DDE5EE] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
            <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#30373E] uppercase block mb-2">STOCK BAS</span>
            <span className="font-serif text-[44px] font-bold leading-none tracking-tight text-[#E0A93A]">{stats.lowStockCount}</span>
          </div>
          <div className="bg-white p-6 border border-[#DDE5EE] rounded-lg shadow-[0_1px_4px_rgba(0,0,0,0.1)]">
            <span className="font-serif text-[10px] font-bold tracking-[0.1em] text-[#30373E] uppercase block mb-2">RUPTURE</span>
            <span className="font-serif text-[44px] font-bold leading-none tracking-tight text-[#F22E75]">{stats.lowStockCount > 0 ? stats.outOfStockCount : '0'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Products List */}
          <div className="lg:col-span-2">
            {/* Filters */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Rechercher un produit..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent max-w-[200px] truncate"
                >
                  <option value="">Toutes catégories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name} ({cat._count.products})</option>
                  ))}
                </select>

                {/* Show cleanup button if there are empty categories */}
                {categories.some(c => c._count.products === 0) && (
                  <button
                    onClick={async () => {
                      const emptyCount = categories.filter(c => c._count.products === 0).length
                      if (confirm(`Supprimer ${emptyCount} catégorie(s) vide(s) ?`)) {
                        const response = await fetch('/api/product-categories/delete-empty', {
                          method: 'POST'
                        })
                        if (response.ok) {
                          router.refresh()
                        }
                      }
                    }}
                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors"
                    title="Supprimer les catégories vides"
                  >
                    Nettoyer catégories
                  </button>
                )}

                <button
                  onClick={() => setShowLowStock(!showLowStock)}
                  className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                    showLowStock 
                      ? 'bg-amber-100 text-amber-700' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Stock bas
                </button>
              </div>
            </div>

            {/* Products Grid */}
            <div className="space-y-3">
              {filteredProducts.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucun produit</h3>
                  <p className="text-gray-500 mb-6">Commencez par ajouter votre premier produit</p>
                  <button
                    onClick={() => setShowNewProductModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl"
                  >
                    Ajouter un produit
                  </button>
                </div>
              ) : (
                filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      {/* Product Image/Icon */}
                      <div className="relative w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt={product.name}
                            fill
                            sizes="64px"
                            unoptimized
                            className="object-cover rounded-xl"
                          />
                        ) : (
                          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">{product.name}</h3>
                          {product.category && (
                            <span 
                              className="px-2 py-0.5 text-xs font-medium rounded-full"
                              style={{ 
                                backgroundColor: `${product.category.color}20`,
                                color: product.category.color || '#6366f1'
                              }}
                            >
                              {product.category.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          {product.sku && <span>SKU: {product.sku}</span>}
                          <span>{product.selling_price.toLocaleString('fr-FR')}€/{product.unit}</span>
                        </div>
                      </div>

                      {/* Stock Level */}
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          product.quantity === 0 ? 'text-red-600' :
                          product.quantity <= product.min_quantity ? 'text-amber-600' :
                          'text-gray-900'
                        }`}>
                          {product.quantity}
                        </div>
                        <div className="text-xs text-gray-500">
                          {product.unit}s en stock
                        </div>
                        {product.quantity <= product.min_quantity && product.quantity > 0 && (
                          <span className="text-xs text-amber-600 font-medium">Stock bas</span>
                        )}
                        {product.quantity === 0 && (
                          <span className="text-xs text-red-600 font-medium">Rupture</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowStockModal(product.id)}
                          className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                          title="Mouvement de stock"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id, product.name)}
                          disabled={deletingId === product.id}
                          className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                          title="Supprimer le produit"
                        >
                          {deletingId === product.id ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Movements Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 sticky top-24">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Mouvements récents</h2>
              </div>
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {recentMovements.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    Aucun mouvement
                  </div>
                ) : (
                  recentMovements.map(movement => {
                    const typeInfo = MOVEMENT_TYPES[movement.type as keyof typeof MOVEMENT_TYPES] || MOVEMENT_TYPES.adjustment
                    return (
                      <div key={movement.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${typeInfo.color}`}>
                            {typeInfo.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {movement.products.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {typeInfo.label} · {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                            </p>
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(movement.created_at).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* New Product Modal */}
      {showNewProductModal && (
        <NewProductModal
          categories={categories}
          onClose={() => setShowNewProductModal(false)}
          onSuccess={() => {
            setShowNewProductModal(false)
            router.refresh()
          }}
        />
      )}

      {/* Stock Movement Modal */}
      {showStockModal && (
        <StockMovementModal
          productId={showStockModal}
          productName={products.find(p => p.id === showStockModal)?.name || ''}
          onClose={() => setShowStockModal(null)}
          onSuccess={() => {
            setShowStockModal(null)
            router.refresh()
          }}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          categories={categories}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

// New Product Modal Component
function NewProductModal({
  categories,
  onClose,
  onSuccess
}: {
  categories: Category[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    description: '',
    category_id: '',
    purchase_price: '',
    selling_price: '',
    quantity: '0',
    min_quantity: '5',
    unit: 'pièce',
    location: '',
    supplier: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        onSuccess()
      } else {
        alert('Erreur lors de la création du produit')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Erreur lors de la création du produit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Nouveau produit</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du produit *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              placeholder="Ex: T-shirt bleu"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                placeholder="TSH-BLU-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code-barres</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                placeholder="3760123456789"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Aucune catégorie</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix d&apos;achat (€)</label>
              <input
                type="number"
                step="0.01"
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                placeholder="10.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (€) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                placeholder="29.99"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantité initiale</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seuil alerte</label>
              <input
                type="number"
                value={formData.min_quantity}
                onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unité</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              >
                <option value="pièce">Pièce</option>
                <option value="kg">Kilogramme</option>
                <option value="litre">Litre</option>
                <option value="mètre">Mètre</option>
                <option value="boîte">Boîte</option>
                <option value="lot">Lot</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emplacement</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                placeholder="Rayon A, Étagère 3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fournisseur</label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                placeholder="Nom du fournisseur"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer le produit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Stock Movement Modal
function StockMovementModal({
  productId,
  productName,
  onClose,
  onSuccess
}: {
  productId: string
  productName: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    type: 'purchase',
    quantity: '',
    unit_price: '',
    reference: '',
    notes: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch(`/api/products/${productId}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          quantity: parseInt(formData.quantity)
        })
      })

      if (response.ok) {
        onSuccess()
      } else {
        const data = await response.json()
        alert(data.error || 'Erreur lors de l\'enregistrement')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Erreur lors de l\'enregistrement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Mouvement de stock</h2>
              <p className="text-sm text-gray-500">{productName}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de mouvement *</label>
            <select
              required
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
            >
              <option value="purchase">Achat (entrée)</option>
              <option value="sale">Vente (sortie)</option>
              <option value="return_in">Retour client (entrée)</option>
              <option value="return_out">Retour fournisseur (sortie)</option>
              <option value="adjustment">Ajustement inventaire</option>
              <option value="loss">Perte/Casse (sortie)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
              <input
                type="number"
                required
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                placeholder="10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix unitaire (€)</label>
              <input
                type="number"
                step="0.01"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                placeholder="15.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Référence</label>
            <input
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              placeholder="N° facture, bon de commande..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              rows={2}
              placeholder="Commentaire optionnel..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Available fields for mapping
const IMPORT_FIELDS = [
  { key: 'name', label: 'Nom du produit', required: true },
  { key: 'sku', label: 'SKU / Référence', required: false },
  { key: 'barcode', label: 'Code-barres / EAN', required: false },
  { key: 'description', label: 'Description', required: false },
  { key: 'category', label: 'Catégorie', required: false },
  { key: 'purchase_price', label: 'Prix d\'achat', required: false },
  { key: 'selling_price', label: 'Prix de vente', required: false },
  { key: 'quantity', label: 'Quantité en stock', required: false },
  { key: 'min_quantity', label: 'Stock minimum', required: false },
  { key: 'unit', label: 'Unité', required: false },
  { key: 'location', label: 'Emplacement', required: false },
  { key: 'supplier', label: 'Fournisseur', required: false },
]

// Import Modal Component
function ImportModal({
  categories,
  onClose,
  onSuccess
}: {
  categories: Category[]
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'result'>('upload')
  const [rawData, setRawData] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, number | null>>({})
  const [error, setError] = useState<string | null>(null)
  const [importStats, setImportStats] = useState<{ success: number; failed: number } | null>(null)

  // Detect CSV delimiter (semicolon or comma)
  const detectDelimiter = (text: string): string => {
    const firstLine = text.split('\n')[0] || ''
    const semicolonCount = (firstLine.match(/;/g) || []).length
    const commaCount = (firstLine.match(/,/g) || []).length
    return semicolonCount >= commaCount ? ';' : ','
  }

  // Parse CSV line handling quoted values
  const parseCSVLine = (line: string, delimiter: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++ // Skip next quote
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  // Auto-detect column mapping based on header names
  const autoDetectMapping = (headerList: string[]): Record<string, number | null> => {
    const mapping: Record<string, number | null> = {}
    
    IMPORT_FIELDS.forEach(field => {
      mapping[field.key] = null
    })
    
    headerList.forEach((header, index) => {
      const h = header.toLowerCase().trim()
      
      if (h === 'nom' || h === 'name' || h === 'produit' || h === 'product' || h === 'libellé' || h === 'libelle' || h === 'désignation' || h === 'designation') {
        mapping.name = index
      } else if (h === 'sku' || h === 'référence' || h === 'reference' || h === 'ref' || h === 'code') {
        mapping.sku = index
      } else if (h === 'code-barres' || h === 'barcode' || h === 'ean' || h === 'code barre' || h === 'codebarre' || h === 'gtin') {
        mapping.barcode = index
      } else if (h === 'description' || h === 'desc' || h === 'détail' || h === 'detail') {
        mapping.description = index
      } else if (h === 'catégorie' || h === 'category' || h === 'categorie' || h === 'cat' || h === 'famille' || h === 'type') {
        mapping.category = index
      } else if (h === 'prix achat' || h === 'purchase_price' || h === 'prix_achat' || h === 'cout' || h === 'coût' || h === 'cost' || h === 'pa' || h === 'prix d\'achat') {
        mapping.purchase_price = index
      } else if (h === 'prix vente' || h === 'selling_price' || h === 'prix_vente' || h === 'prix' || h === 'price' || h === 'pv' || h === 'prix de vente' || h === 'tarif') {
        mapping.selling_price = index
      } else if (h === 'quantité' || h === 'quantity' || h === 'qté' || h === 'qte' || h === 'stock' || h === 'qty' || h === 'en stock') {
        mapping.quantity = index
      } else if (h === 'stock min' || h === 'min_quantity' || h === 'stock_min' || h === 'min' || h === 'seuil' || h === 'alerte') {
        mapping.min_quantity = index
      } else if (h === 'unité' || h === 'unit' || h === 'unite' || h === 'u') {
        mapping.unit = index
      } else if (h === 'emplacement' || h === 'location' || h === 'lieu' || h === 'place' || h === 'rayon') {
        mapping.location = index
      } else if (h === 'fournisseur' || h === 'supplier' || h === 'vendor' || h === 'fabricant') {
        mapping.supplier = index
      }
    })
    
    return mapping
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setError(null)
    setStep('upload')

    try {
      const text = await selectedFile.text()
      
      if (selectedFile.name.endsWith('.json')) {
        const data = JSON.parse(text)
        if (Array.isArray(data) && data.length > 0) {
          // For JSON, extract keys as headers
          const jsonHeaders = Object.keys(data[0])
          setHeaders(jsonHeaders)
          setRawData(data.map(item => jsonHeaders.map(h => item[h]?.toString() || '')))
          setColumnMapping(autoDetectMapping(jsonHeaders))
          setStep('mapping')
        } else {
          setError('Le fichier JSON doit contenir un tableau de produits non vide')
        }
      } else if (selectedFile.name.endsWith('.csv')) {
        const lines = text.split(/\r?\n/).filter(line => line.trim())
        if (lines.length < 2) {
          setError('Le fichier CSV est vide ou ne contient pas de données')
          return
        }
        
        const delimiter = detectDelimiter(text)
        const csvHeaders = parseCSVLine(lines[0], delimiter)
        const csvData = lines.slice(1).map(line => parseCSVLine(line, delimiter))
        
        setHeaders(csvHeaders)
        setRawData(csvData)
        setColumnMapping(autoDetectMapping(csvHeaders))
        setStep('mapping')
      } else {
        setError('Format non supporté. Utilisez CSV ou JSON.')
      }
    } catch (err) {
      setError('Erreur lors de la lecture du fichier: ' + (err as Error).message)
      console.error(err)
    }
  }

  // Build products from raw data using column mapping
  const buildProducts = (): any[] => {
    return rawData.map(row => {
      const product: any = {}
      
      IMPORT_FIELDS.forEach(field => {
        const colIndex = columnMapping[field.key]
        if (colIndex !== null && colIndex !== undefined && row[colIndex] !== undefined) {
          product[field.key] = row[colIndex]?.trim() || ''
        }
      })
      
      return product
    }).filter(p => p.name && p.name.trim() !== '')
  }

  // Get preview products (first 5)
  const getPreviewProducts = () => {
    return buildProducts().slice(0, 5)
  }

  const handleImport = async () => {
    if (columnMapping.name === null) {
      setError('Veuillez sélectionner la colonne "Nom du produit"')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const products = buildProducts()

      if (products.length === 0) {
        setError('Aucun produit valide à importer')
        setLoading(false)
        return
      }

      // Send to API
      const response = await fetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products })
      })

      const result = await response.json()

      if (response.ok) {
        setImportStats({ success: result.imported, failed: result.failed })
        setStep('result')
        if (result.imported > 0) {
          setTimeout(() => onSuccess(), 2000)
        }
      } else {
        setError(result.error || 'Erreur lors de l\'import')
      }
    } catch (err) {
      setError('Erreur lors de l\'import')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Importer des produits</h2>
              <p className="text-sm text-gray-500 mt-1">
                {step === 'upload' && 'Étape 1/3 - Sélection du fichier'}
                {step === 'mapping' && 'Étape 2/3 - Configuration des colonnes'}
                {step === 'preview' && 'Étape 3/3 - Vérification'}
                {step === 'result' && 'Import terminé'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-4">
            {['upload', 'mapping', 'preview'].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s ? 'bg-emerald-500 text-white' :
                  ['upload', 'mapping', 'preview'].indexOf(step) > i || step === 'result' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {i + 1}
                </div>
                {i < 2 && <div className={`w-12 h-1 mx-1 rounded ${
                  ['upload', 'mapping', 'preview'].indexOf(step) > i || step === 'result' ? 'bg-emerald-200' : 'bg-gray-200'
                }`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-700 p-4 rounded-xl flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Step 1: File Upload */}
          {step === 'upload' && (
            <>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-emerald-400 transition-colors">
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-gray-600 mb-2">Cliquez pour sélectionner un fichier</p>
                  <p className="text-xs text-gray-400">CSV ou JSON</p>
                </label>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-xl">
                <h4 className="font-medium text-blue-900 mb-2">Formats acceptés</h4>
                <p className="text-sm text-blue-700">
                  Importez un fichier CSV ou JSON depuis n&apos;importe quelle application. 
                  Vous pourrez ensuite choisir quelle colonne correspond à quel champ.
                </p>
              </div>
            </>
          )}

          {/* Step 2: Column Mapping */}
          {step === 'mapping' && (
            <>
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Fichier: {file?.name}</span>
                  <span className="text-sm text-gray-500">{rawData.length} lignes détectées</span>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium text-gray-900">Associez les colonnes de votre fichier</h3>
                <p className="text-sm text-gray-500">Sélectionnez quelle colonne correspond à chaque champ. Seul le nom est obligatoire.</p>
                
                <div className="grid gap-3">
                  {IMPORT_FIELDS.map(field => (
                    <div key={field.key} className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg p-3">
                      <div className="w-40 flex-shrink-0">
                        <span className="text-sm font-medium text-gray-700">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </span>
                      </div>
                      <div className="flex-1">
                        <select
                          value={columnMapping[field.key] ?? ''}
                          onChange={(e) => setColumnMapping({
                            ...columnMapping,
                            [field.key]: e.target.value === '' ? null : parseInt(e.target.value)
                          })}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                            field.required && columnMapping[field.key] === null ? 'border-red-300' : 'border-gray-200'
                          }`}
                        >
                          <option value="">-- Ne pas importer --</option>
                          {headers.map((header, index) => (
                            <option key={index} value={index}>
                              {header} {rawData[0]?.[index] ? `(ex: "${rawData[0][index].substring(0, 20)}${rawData[0][index].length > 20 ? '...' : ''}")` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Data Preview */}
              <div className="mt-6">
                <h3 className="font-medium text-gray-900 mb-2">Aperçu des données brutes (3 premières lignes)</h3>
                <div className="overflow-x-auto bg-gray-50 rounded-xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        {headers.map((header, i) => (
                          <th key={i} className="px-3 py-2 text-left text-gray-600 font-medium whitespace-nowrap">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rawData.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-gray-200">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[150px] truncate">
                              {cell || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setStep('upload'); setFile(null); setHeaders([]); setRawData([]); }}
                  className="px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200"
                >
                  Retour
                </button>
                <button
                  onClick={() => {
                    if (columnMapping.name === null) {
                      setError('Veuillez sélectionner la colonne "Nom du produit"')
                    } else {
                      setError(null)
                      setStep('preview')
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-teal-600"
                >
                  Continuer
                </button>
              </div>
            </>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <>
              <div className="bg-emerald-50 p-4 rounded-xl">
                <p className="text-emerald-700">
                  <strong>{buildProducts().length}</strong> produits prêts à être importés
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-2">Aperçu des produits à importer</h3>
                <div className="overflow-x-auto bg-gray-50 rounded-xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-3 py-2 text-left text-gray-600 font-medium">Nom</th>
                        <th className="px-3 py-2 text-left text-gray-600 font-medium">SKU</th>
                        <th className="px-3 py-2 text-left text-gray-600 font-medium">Prix</th>
                        <th className="px-3 py-2 text-left text-gray-600 font-medium">Qté</th>
                        <th className="px-3 py-2 text-left text-gray-600 font-medium">Catégorie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPreviewProducts().map((p, i) => (
                        <tr key={i} className="border-t border-gray-200">
                          <td className="px-3 py-2 font-medium text-gray-900">{p.name || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{p.sku || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{p.selling_price || '-'}</td>
                          <td className="px-3 py-2 text-gray-600">{p.quantity || '0'}</td>
                          <td className="px-3 py-2 text-gray-600">{p.category || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {buildProducts().length > 5 && (
                    <p className="text-center text-sm text-gray-500 py-2">
                      ... et {buildProducts().length - 5} autres produits
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep('mapping')}
                  className="px-4 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200"
                >
                  Retour
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50"
                >
                  {loading ? 'Import en cours...' : `Importer ${buildProducts().length} produits`}
                </button>
              </div>
            </>
          )}

          {/* Step 4: Result */}
          {step === 'result' && importStats && (
            <>
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Import terminé</h3>
                <p className="text-gray-600">
                  <strong className="text-emerald-600">{importStats.success}</strong> produits importés avec succès
                  {importStats.failed > 0 && (
                    <span className="text-red-600"> · {importStats.failed} échecs</span>
                  )}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium rounded-xl hover:from-emerald-600 hover:to-teal-600"
                >
                  Fermer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
