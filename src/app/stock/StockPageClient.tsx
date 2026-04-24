'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Wallet } from 'lucide-react'

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
  purchase: { label: 'Purchase', icon: '+', color: 'text-[#3FA46A] bg-[#3FA46A]/10' },
  sale: { label: 'Sale', icon: '-', color: 'text-[#2764FF] bg-[#2764FF]/10' },
  return_in: { label: 'Customer return', icon: '←', color: 'text-purple-600 bg-purple-50' },
  return_out: { label: 'Supplier return', icon: '→', color: 'text-orange-600 bg-orange-50' },
  adjustment: { label: 'Adjustment', icon: '±', color: 'text-[#30373E] bg-[#F2F8FF]' },
  transfer: { label: 'Transfer', icon: '⇄', color: 'text-indigo-600 bg-indigo-50' },
  loss: { label: 'Loss', icon: '×', color: 'text-[#F22E75] bg-[#FFE7EC]' },
  initial: { label: 'Initial stock', icon: '○', color: 'text-teal-600 bg-teal-50' },
}

const DEFAULT_VISIBLE_PRODUCTS = 16

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
  const [productsCollapsed, setProductsCollapsed] = useState(false)
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false)

  // Delete product handler
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete "${productName}"?`)) {
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
        alert('Error during deletion')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error during deletion')
    } finally {
      setDeletingId(null)
    }
  }

  // Delete all products and categories handler
  const handleDeleteAll = async () => {
    if (products.length === 0 && categories.length === 0) {
      alert('No products or categories to delete')
      return
    }

    const confirmation = prompt(
      `Are you sure you want to delete ALL ${products.length} products and ${categories.length} categories?\n\nThis action is irreversible.\n\nType "DELETE" to confirm:`
    )

    if (confirmation !== 'DELETE') {
      return
    }

    try {
      const response = await fetch('/api/products/delete-all', {
        method: 'DELETE'
      })

      if (response.ok) {
        const data = await response.json()
        alert(`${data.deleted} product(s) and ${data.categoriesDeleted || 0} category(ies) deleted`)
        router.refresh()
      } else {
        alert('Error during deletion')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error during deletion')
    }
  }

  // Export products to CSV
  const handleExportCSV = () => {
    const headers = ['Name', 'SKU', 'Barcode', 'Description', 'Category', 'Purchase price', 'Selling price', 'Quantity', 'Min stock', 'Unit', 'Location', 'Supplier']
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

  const hasHiddenProducts = filteredProducts.length > DEFAULT_VISIBLE_PRODUCTS
  const displayedProducts = showAllProducts
    ? filteredProducts
    : filteredProducts.slice(0, DEFAULT_VISIBLE_PRODUCTS)

  useEffect(() => {
    setShowAllProducts(false)
  }, [searchQuery, selectedCategory, showLowStock])

  return (
    <div className="min-h-screen bg-[#F2F8FF]">
      {/* Header */}
      <header className="bg-white border-b border-[#DDE5EE] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 hover:bg-[#F2F8FF] rounded-lg transition-colors">
                <svg className="w-5 h-5 text-[#30373E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-[#03182F]">Stock management</h1>
                <p className="text-sm text-[#6B7480]">{stats.totalProducts} products in stock</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Import/Export Dropdown */}
              <div
                className="relative group"
                onMouseLeave={() => setIsImportMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setIsImportMenuOpen((value) => !value)}
                  className="flex items-center gap-2 px-3 py-2 text-[#30373E] hover:bg-[#F2F8FF] rounded-xl transition-colors outline-none focus:ring-2 focus:ring-[#2764FF]/50"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="hidden sm:inline">Import/Export</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  className={`absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-[#DDE5EE] transition-all z-50 ${
                    isImportMenuOpen
                      ? 'opacity-100 visible'
                      : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'
                  }`}
                >
                  <button
                    onClick={() => {
                      setShowImportModal(true)
                      setIsImportMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-[#30373E] hover:bg-[#F2F8FF] rounded-t-xl"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Import (CSV/JSON)
                  </button>
                  <button
                    onClick={() => {
                      handleExportCSV()
                      setIsImportMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-[#30373E] hover:bg-[#F2F8FF]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </button>
                  <button
                    onClick={() => {
                      handleExportJSON()
                      setIsImportMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-[#30373E] hover:bg-[#F2F8FF]"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    Export JSON
                  </button>
                  <div className="border-t border-[#DDE5EE]"></div>
                  <button
                    onClick={() => {
                      handleDeleteAll()
                      setIsImportMenuOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left text-[#F22E75] hover:bg-[#FFE7EC] rounded-b-xl"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete all
                  </button>
                </div>
              </div>
              
              <button
                onClick={() => setShowNewProductModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#004bd9] text-white font-medium rounded-xl hover:bg-[#004bd9]/90 transition-all shadow-lg hover:shadow-xl"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New product
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-[#DDE5EE]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#2764FF]/10 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-[#2764FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-[#6B7480]">Total products</p>
                <p className="text-2xl font-bold text-[#03182F]">{stats.totalProducts}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-[#DDE5EE]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#3FA46A]/10 rounded-xl flex items-center justify-center">
                <Wallet className="w-6 h-6 text-[#3FA46A]" />
              </div>
              <div>
                <p className="text-sm text-[#6B7480]">Stock value</p>
                <p className="text-2xl font-bold text-[#03182F]">{stats.totalValue.toLocaleString('en-US')}€</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-[#DDE5EE]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#E0A93A]/10 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-[#E0A93A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-[#6B7480]">Low stock</p>
                <p className="text-2xl font-bold text-[#E0A93A]">{stats.lowStockCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-[#DDE5EE]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#FFE7EC] rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-[#F22E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-[#6B7480]">Out of stock</p>
                <p className="text-2xl font-bold text-[#F22E75]">{stats.outOfStockCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Products List */}
          <div className="lg:col-span-2">
            {/* Filters */}
            <div className="bg-white rounded-lg p-4 shadow-sm border border-[#DDE5EE] mb-6 font-serif">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7480]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search a product..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff] focus:border-transparent font-serif"
                    />
                  </div>
                </div>
                
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff] focus:border-transparent max-w-[200px] truncate font-serif"
                >
                  <option value="">All categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name} ({cat._count.products})</option>
                  ))}
                </select>

                {/* Show cleanup button if there are empty categories */}
                {categories.some(c => c._count.products === 0) && (
                  <button
                    onClick={async () => {
                      const emptyCount = categories.filter(c => c._count.products === 0).length
                      if (confirm(`Delete ${emptyCount} empty category(ies)?`)) {
                        const response = await fetch('/api/product-categories/delete-empty', {
                          method: 'POST'
                        })
                        if (response.ok) {
                          router.refresh()
                        }
                      }
                    }}
                    className="px-3 py-2 text-sm text-[#F22E75] hover:bg-[#FFE7EC] rounded-xl font-medium transition-colors font-serif"
                    title="Delete empty categories"
                  >
                    Clean categories
                  </button>
                )}

                <button
                  onClick={() => setShowLowStock(!showLowStock)}
                  className={`px-4 py-2 rounded-xl font-medium transition-colors font-serif ${
                    showLowStock 
                      ? 'bg-[#E0A93A]/10 text-amber-700' 
                      : 'bg-[#F2F8FF] text-[#30373E] hover:bg-gray-200'
                  }`}
                >
                  Low stock
                </button>
              </div>
            </div>

            {/* Products Grid */}
            <div className="bg-white rounded-lg shadow-sm border border-[#DDE5EE] font-serif">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DDE5EE] px-4 py-3">
                <div>
                  <h2 className="text-base font-semibold text-[#03182F] font-serif">Products list</h2>
                  <p className="text-xs text-[#6B7480] font-serif">
                    {filteredProducts.length} result{filteredProducts.length > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!productsCollapsed && hasHiddenProducts && (
                    <button
                      type="button"
                      onClick={() => setShowAllProducts((value) => !value)}
                      className="rounded-lg border border-[#DDE5EE] px-3 py-1.5 text-xs font-medium text-[#30373E] hover:bg-[#F2F8FF] font-serif"
                    >
                      {showAllProducts
                        ? `Show less (${DEFAULT_VISIBLE_PRODUCTS})`
                        : `Show all (${filteredProducts.length})`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setProductsCollapsed((value) => !value)}
                    className="rounded-lg border border-[#DDE5EE] px-2.5 py-1.5 text-[#30373E] hover:bg-[#F2F8FF] font-serif"
                    aria-label={productsCollapsed ? 'Expand products list' : 'Collapse products list'}
                    title={productsCollapsed ? 'Expand products list' : 'Collapse products list'}
                  >
                    <svg
                      className={`h-4 w-4 transition-transform ${productsCollapsed ? '' : 'rotate-180'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {productsCollapsed ? (
                <div className="px-4 py-5 text-sm text-[#6B7480] font-serif">List collapsed.</div>
              ) : filteredProducts.length === 0 ? (
                <div className="p-12 text-center font-serif">
                  <div className="w-16 h-16 mx-auto mb-4 bg-[#F2F8FF] rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-[#6B7480]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-[#03182F] mb-2 font-serif">No products</h3>
                  <p className="text-[#6B7480] mb-6 font-serif">Start by adding your first product</p>
                  <button
                    onClick={() => setShowNewProductModal(true)}
                    className="px-6 py-3 bg-[#004bd9] text-white font-medium rounded-xl font-serif"
                  >
                    Add a product
                  </button>
                </div>
              ) : (
                <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3 font-serif">
                  {displayedProducts.map(product => (
                    <div
                      key={product.id}
                      className="bg-white rounded-xl p-4 shadow-sm border border-[#DDE5EE] hover:shadow-md transition-shadow font-serif"
                    >
                      <div className="flex items-center gap-4">
                        {/* Product Image/Icon */}
                        <div className="relative w-16 h-16 bg-[#F2F8FF] rounded-xl flex items-center justify-center flex-shrink-0">
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
                            <svg className="w-6 h-6 text-[#6B7480]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-[#03182F] truncate">{product.name}</h3>
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
                          <div className="flex items-center gap-4 text-sm text-[#6B7480]">
                            {product.sku && <span>SKU: {product.sku}</span>}
                            <span>€{product.selling_price.toLocaleString('en-US')}/{product.unit}</span>
                          </div>
                        </div>

                        {/* Stock Level */}
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${
                            product.quantity === 0 ? 'text-[#F22E75]' :
                            product.quantity <= product.min_quantity ? 'text-[#E0A93A]' :
                            'text-[#03182F]'
                          }`}>
                            {product.quantity}
                          </div>
                          <div className="text-xs text-[#6B7480]">
                            {product.unit} in stock
                          </div>
                          {product.quantity <= product.min_quantity && product.quantity > 0 && (
                            <span className="text-xs text-[#E0A93A] font-medium">Low stock</span>
                          )}
                          {product.quantity === 0 && (
                            <span className="text-xs text-[#F22E75] font-medium">Out of stock</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowStockModal(product.id)}
                            className="p-2 bg-[#3FA46A]/10 text-[#3FA46A] rounded-lg hover:bg-[#3FA46A]/10 transition-colors"
                            title="Stock movement"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id, product.name)}
                            disabled={deletingId === product.id}
                            className="p-2 bg-[#FFE7EC] text-[#F22E75] rounded-lg hover:bg-[#FFE7EC] transition-colors disabled:opacity-50"
                            title="Delete product"
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
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Movements Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-[#DDE5EE] sticky top-24">
              <div className="p-4 border-b border-[#DDE5EE]">
                <h2 className="font-semibold text-[#03182F]">Recent movements</h2>
              </div>
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {recentMovements.length === 0 ? (
                  <div className="p-6 text-center text-[#6B7480]">
                    No movements
                  </div>
                ) : (
                  recentMovements.map(movement => {
                    const typeInfo = MOVEMENT_TYPES[movement.type as keyof typeof MOVEMENT_TYPES] || MOVEMENT_TYPES.adjustment
                    return (
                      <div key={movement.id} className="p-4 hover:bg-[#F2F8FF]">
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${typeInfo.color}`}>
                            {typeInfo.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#03182F] truncate">
                              {movement.products.name}
                            </p>
                            <p className="text-xs text-[#6B7480]">
                              {typeInfo.label} · {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                            </p>
                          </div>
                          <span className="text-xs text-[#6B7480]">
                            {new Date(movement.created_at).toLocaleDateString('en-US')}
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
        unit: 'piece',
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
        alert('Error creating product')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error creating product')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[#DDE5EE]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#03182F]">New product</h2>
            <button onClick={onClose} className="p-2 hover:bg-[#F2F8FF] rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#30373E] mb-1">Product name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
              placeholder="e.g. Blue T-shirt"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#30373E] mb-1">SKU</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
                placeholder="TSH-BLU-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#30373E] mb-1">Barcode</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
                placeholder="3760123456789"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#30373E] mb-1">Category</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
            >
              <option value="">No category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#30373E] mb-1">Purchase price (€)</label>
              <input
                type="number"
                step="0.01"
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
                placeholder="10.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#30373E] mb-1">Selling price (€) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
                placeholder="29.99"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#30373E] mb-1">Initial quantity</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#30373E] mb-1">Alert threshold</label>
              <input
                type="number"
                value={formData.min_quantity}
                onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })}
                className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#30373E] mb-1">Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
              >
                <option value="piece">Piece</option>
                <option value="kg">Kilogram</option>
                <option value="litre">Liter</option>
                <option value="metre">Meter</option>
                <option value="box">Box</option>
                <option value="lot">Lot</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#30373E] mb-1">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
                placeholder="Aisle A, Shelf 3"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#30373E] mb-1">Supplier</label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
                placeholder="Supplier name"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-[#F2F8FF] text-[#30373E] font-medium rounded-xl hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#004bd9] text-white font-medium rounded-xl hover:bg-[#004bd9]/90 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create product'}
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
        alert(data.error || 'Error saving')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error saving')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-[#DDE5EE]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#03182F]">Stock movement</h2>
              <p className="text-sm text-[#6B7480]">{productName}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[#F2F8FF] rounded-lg">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#30373E] mb-1">Movement type *</label>
            <select
              required
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
            >
              <option value="purchase">Purchase (inbound)</option>
              <option value="sale">Sale (outbound)</option>
              <option value="return_in">Customer return (inbound)</option>
              <option value="return_out">Supplier return (outbound)</option>
              <option value="adjustment">Inventory adjustment</option>
              <option value="loss">Loss/Breakage (outbound)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#30373E] mb-1">Quantity *</label>
              <input
                type="number"
                required
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
                placeholder="10"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#30373E] mb-1">Unit price (€)</label>
              <input
                type="number"
                step="0.01"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
                placeholder="15.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#30373E] mb-1">Reference</label>
            <input
              type="text"
              value={formData.reference}
              onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
              className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
              placeholder="Invoice #, purchase order..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#30373E] mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-[#DDE5EE] rounded-xl focus:ring-2 focus:ring-[#2764ff]"
              rows={2}
              placeholder="Optional comment..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-[#F2F8FF] text-[#30373E] font-medium rounded-xl hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#004bd9] text-white font-medium rounded-xl hover:bg-[#004bd9]/90 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Available fields for mapping
const IMPORT_FIELDS = [
  { key: 'name', label: 'Product name', required: true },
  { key: 'sku', label: 'SKU / Reference', required: false },
  { key: 'barcode', label: 'Barcode / EAN', required: false },
  { key: 'description', label: 'Description', required: false },
  { key: 'category', label: 'Category', required: false },
  { key: 'purchase_price', label: 'Purchase price', required: false },
  { key: 'selling_price', label: 'Selling price', required: false },
  { key: 'quantity', label: 'Stock quantity', required: false },
  { key: 'min_quantity', label: 'Minimum stock', required: false },
  { key: 'unit', label: 'Unit', required: false },
  { key: 'location', label: 'Location', required: false },
  { key: 'supplier', label: 'Supplier', required: false },
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
      
      if (h === 'nom' || h === 'name' || h === 'produit' || h === 'product' || h === 'label' || h === 'label' || h === 'designation' || h === 'designation') {
        mapping.name = index
      } else if (h === 'sku' || h === 'reference' || h === 'reference' || h === 'ref' || h === 'code') {
        mapping.sku = index
      } else if (h === 'code-barres' || h === 'barcode' || h === 'ean' || h === 'code barre' || h === 'codebarre' || h === 'gtin') {
        mapping.barcode = index
      } else if (h === 'description' || h === 'desc' || h === 'detail' || h === 'detail') {
        mapping.description = index
      } else if (h === 'category' || h === 'category' || h === 'category' || h === 'cat' || h === 'famille' || h === 'type') {
        mapping.category = index
      } else if (h === 'prix achat' || h === 'purchase_price' || h === 'prix_achat' || h === 'cost' || h === 'cost' || h === 'cost' || h === 'pa' || h === 'prix d\'achat') {
        mapping.purchase_price = index
      } else if (h === 'prix vente' || h === 'selling_price' || h === 'prix_vente' || h === 'prix' || h === 'price' || h === 'pv' || h === 'prix de vente' || h === 'tarif') {
        mapping.selling_price = index
      } else if (h === 'quantity' || h === 'quantity' || h === 'qty' || h === 'qty' || h === 'stock' || h === 'qty' || h === 'en stock') {
        mapping.quantity = index
      } else if (h === 'stock min' || h === 'min_quantity' || h === 'stock_min' || h === 'min' || h === 'seuil' || h === 'alerte') {
        mapping.min_quantity = index
      } else if (h === 'unit' || h === 'unite' || h === 'u') {
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
          setError('The JSON file must costain a non-empty array of products')
        }
      } else if (selectedFile.name.endsWith('.csv')) {
        const lines = text.split(/\r?\n/).filter(line => line.trim())
        if (lines.length < 2) {
          setError('The CSV file is empty or costains no data')
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
        setError('Unsupported format. Use CSV or JSON.')
      }
    } catch (err) {
      setError('Error reading file: ' + (err as Error).message)
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
      setError('Please select the "Product name" column')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const products = buildProducts()

      if (products.length === 0) {
        setError('No valid products to import')
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
        setError(result.error || 'Error during import')
      }
    } catch (err) {
      setError('Error during import')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[#DDE5EE]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#03182F]">Import products</h2>
              <p className="text-sm text-[#6B7480] mt-1">
                {step === 'upload' && 'Step 1/3 - File selection'}
                {step === 'mapping' && 'Step 2/3 - Column configuration'}
                {step === 'preview' && 'Step 3/3 - Verification'}
                {step === 'result' && 'Import complete'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[#F2F8FF] rounded-lg">
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
                  step === s ? 'bg-[#3FA46A]/100 text-white' :
                  ['upload', 'mapping', 'preview'].indexOf(step) > i || step === 'result' ? 'bg-[#3FA46A]/10 text-emerald-700' :
                  'bg-[#F2F8FF] text-[#6B7480]'
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
            <div className="bg-[#FFE7EC] text-red-700 p-4 rounded-xl flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Step 1: File Upload */}
          {step === 'upload' && (
            <>
              <div className="border-2 border-dashed border-[#DDE5EE] rounded-xl p-8 text-center hover:border-emerald-400 transition-colors">
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <svg className="w-12 h-12 mx-auto text-[#6B7480] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-[#30373E] mb-2">Click to select a file</p>
                  <p className="text-xs text-[#6B7480]">CSV or JSON</p>
                </label>
              </div>
              
              <div className="bg-[#2764FF]/10 p-4 rounded-xl">
                <h4 className="font-medium text-blue-900 mb-2">Accepted formats</h4>
                <p className="text-sm text-[#004bd9]">
                  Import a CSV or JSON file from any application.
                  You can then choose which column corresponds to each field.
                </p>
              </div>
            </>
          )}

          {/* Step 2: Column Mapping */}
          {step === 'mapping' && (
            <>
              <div className="bg-[#F2F8FF] rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#30373E]">File: {file?.name}</span>
                  <span className="text-sm text-[#6B7480]">{rawData.length} rows detected</span>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium text-[#03182F]">Map your file columns</h3>
                <p className="text-sm text-[#6B7480]">Select which column corresponds to each field. Only the name is required.</p>
                
                <div className="grid gap-3">
                  {IMPORT_FIELDS.map(field => (
                    <div key={field.key} className="flex items-center gap-4 bg-white border border-[#DDE5EE] rounded-lg p-3">
                      <div className="w-40 flex-shrink-0">
                        <span className="text-sm font-medium text-[#30373E]">
                          {field.label}
                          {field.required && <span className="text-[#F22E75] ml-1">*</span>}
                        </span>
                      </div>
                      <div className="flex-1">
                        <select
                          value={columnMapping[field.key] ?? ''}
                          onChange={(e) => setColumnMapping({
                            ...columnMapping,
                            [field.key]: e.target.value === '' ? null : parseInt(e.target.value)
                          })}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#2764ff] focus:border-transparent ${
                            field.required && columnMapping[field.key] === null ? 'border-red-300' : 'border-[#DDE5EE]'
                          }`}
                        >
                          <option value="">-- Do not import --</option>
                          {headers.map((header, index) => (
                            <option key={index} value={index}>
                              {header} {rawData[0]?.[index] ? `(e.g. "${rawData[0][index].substring(0, 20)}${rawData[0][index].length > 20 ? '...' : ''}")` : ''}
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
                <h3 className="font-medium text-[#03182F] mb-2">Raw data preview (first 3 rows)</h3>
                <div className="overflow-x-auto bg-[#F2F8FF] rounded-xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#F2F8FF]">
                        {headers.map((header, i) => (
                          <th key={i} className="px-3 py-2 text-left text-[#30373E] font-medium whitespace-nowrap">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rawData.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-[#DDE5EE]">
                          {row.map((cell, j) => (
                            <td key={j} className="px-3 py-2 text-[#30373E] whitespace-nowrap max-w-[150px] truncate">
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
                  className="px-4 py-3 bg-[#F2F8FF] text-[#30373E] font-medium rounded-xl hover:bg-gray-200"
                >
                  Back
                </button>
                <button
                  onClick={() => {
                    if (columnMapping.name === null) {
                      setError('Please select the "Product name" column')
                    } else {
                      setError(null)
                      setStep('preview')
                    }
                  }}
                  className="flex-1 px-4 py-3 bg-[#004bd9] text-white font-medium rounded-xl hover:bg-[#004bd9]/90"
                >
                  Continue
                </button>
              </div>
            </>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <>
              <div className="bg-[#3FA46A]/10 p-4 rounded-xl">
                <p className="text-emerald-700">
                  <strong>{buildProducts().length}</strong> products ready to import
                </p>
              </div>

              <div>
                <h3 className="font-medium text-[#03182F] mb-2">Preview of products to import</h3>
                <div className="overflow-x-auto bg-[#F2F8FF] rounded-xl">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#F2F8FF]">
                        <th className="px-3 py-2 text-left text-[#30373E] font-medium">Name</th>
                        <th className="px-3 py-2 text-left text-[#30373E] font-medium">SKU</th>
                        <th className="px-3 py-2 text-left text-[#30373E] font-medium">Price</th>
                        <th className="px-3 py-2 text-left text-[#30373E] font-medium">Qty</th>
                        <th className="px-3 py-2 text-left text-[#30373E] font-medium">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getPreviewProducts().map((p, i) => (
                        <tr key={i} className="border-t border-[#DDE5EE]">
                          <td className="px-3 py-2 font-medium text-[#03182F]">{p.name || '-'}</td>
                          <td className="px-3 py-2 text-[#30373E]">{p.sku || '-'}</td>
                          <td className="px-3 py-2 text-[#30373E]">{p.selling_price || '-'}</td>
                          <td className="px-3 py-2 text-[#30373E]">{p.quantity || '0'}</td>
                          <td className="px-3 py-2 text-[#30373E]">{p.category || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {buildProducts().length > 5 && (
                    <p className="text-center text-sm text-[#6B7480] py-2">
                      ... and {buildProducts().length - 5} more products
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep('mapping')}
                  className="px-4 py-3 bg-[#F2F8FF] text-[#30373E] font-medium rounded-xl hover:bg-gray-200"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-[#004bd9] text-white font-medium rounded-xl hover:bg-[#004bd9]/90 disabled:opacity-50"
                >
                  {loading ? 'Importing...' : `Import ${buildProducts().length} products`}
                </button>
              </div>
            </>
          )}

          {/* Step 4: Result */}
          {step === 'result' && importStats && (
            <>
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-[#3FA46A]/10 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-[#3FA46A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[#03182F] mb-2">Import complete</h3>
                <p className="text-[#30373E]">
                  <strong className="text-[#3FA46A]">{importStats.success}</strong> products successfully imported
                  {importStats.failed > 0 && (
                    <span className="text-[#F22E75]"> · {importStats.failed} failed</span>
                  )}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-[#004bd9] text-white font-medium rounded-xl hover:bg-[#004bd9]/90"
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
