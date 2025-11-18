import React, { useEffect, useState, useCallback } from 'react'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { productsAPI, categoriesAPI } from '../services/api'
import type { Product, Category } from '../../../shared/types'

interface ColumnConfig {
  id: string
  label: string
  visible: boolean
  width: number
  order: number
}

const defaultColumns: ColumnConfig[] = [
  { id: 'checkbox', label: '', visible: true, width: 50, order: 0 },
  { id: 'id', label: 'ID', visible: true, width: 80, order: 1 },
  { id: 'name', label: 'Məhsul adı', visible: true, width: 200, order: 2 },
  { id: 'code', label: 'Kod', visible: true, width: 120, order: 3 },
  { id: 'barcode', label: 'Barkod', visible: true, width: 150, order: 4 },
  { id: 'unit', label: 'Vahid', visible: true, width: 100, order: 5 },
  { id: 'purchase_price', label: 'Alış qiyməti', visible: true, width: 130, order: 6 },
  { id: 'sale_price', label: 'Satış qiyməti', visible: true, width: 130, order: 7 },
  { id: 'quantity', label: 'Qalıq', visible: true, width: 120, order: 8 },
  { id: 'purchase_total', label: 'Alış cəm', visible: true, width: 130, order: 9 },
  { id: 'sale_total', label: 'Satış cəm', visible: true, width: 130, order: 10 },
]

// localStorage-dan columns yüklə
const loadColumnsFromStorage = (): ColumnConfig[] => {
  try {
    const saved = localStorage.getItem('anbar-columns-config')
    if (saved) {
      const loaded = JSON.parse(saved)
      // Əgər cəm sütunları yoxdursa, əlavə et
      const hasPurchaseTotal = loaded.some((col: ColumnConfig) => col.id === 'purchase_total')
      const hasSaleTotal = loaded.some((col: ColumnConfig) => col.id === 'sale_total')
      const hasOldTotal = loaded.some((col: ColumnConfig) => col.id === 'total')
      
      // Köhnə "total" sütununu sil və yeni sütunları əlavə et
      if (hasOldTotal) {
        const oldTotalIndex = loaded.findIndex((col: ColumnConfig) => col.id === 'total')
        if (oldTotalIndex >= 0) {
          loaded.splice(oldTotalIndex, 1)
        }
      }
      
      if (!hasPurchaseTotal || !hasSaleTotal) {
        const quantityIndex = loaded.findIndex((col: ColumnConfig) => col.id === 'quantity')
        if (quantityIndex >= 0) {
          const quantityOrder = loaded[quantityIndex].order
          
          // Alış cəm sütununu əlavə et
          if (!hasPurchaseTotal) {
            loaded.splice(quantityIndex + 1, 0, {
              id: 'purchase_total',
              label: 'Alış cəm',
              visible: true,
              width: 130,
              order: quantityOrder + 1
            })
          }
          
          // Satış cəm sütununu əlavə et
          if (!hasSaleTotal) {
            const purchaseTotalIndex = loaded.findIndex((col: ColumnConfig) => col.id === 'purchase_total')
            const insertIndex = purchaseTotalIndex >= 0 ? purchaseTotalIndex + 1 : quantityIndex + 1
            loaded.splice(insertIndex, 0, {
              id: 'sale_total',
              label: 'Satış cəm',
              visible: true,
              width: 130,
              order: quantityOrder + 2
            })
          }
          
          // Sonrakı sütunların order-ni yenilə
          loaded.forEach((col: ColumnConfig) => {
            if (col.id !== 'purchase_total' && col.id !== 'sale_total' && col.order > quantityOrder) {
              col.order = col.order + (hasPurchaseTotal && hasSaleTotal ? 0 : hasPurchaseTotal || hasSaleTotal ? 1 : 2)
            }
          })
        } else {
          // Əgər qalıq sütunu yoxdursa, sona əlavə et
          const maxOrder = Math.max(...loaded.map((col: ColumnConfig) => col.order), -1)
          if (!hasPurchaseTotal) {
            loaded.push({
              id: 'purchase_total',
              label: 'Alış cəm',
              visible: true,
              width: 130,
              order: maxOrder + 1
            })
          }
          if (!hasSaleTotal) {
            loaded.push({
              id: 'sale_total',
              label: 'Satış cəm',
              visible: true,
              width: 130,
              order: maxOrder + 2
            })
          }
        }
      }
      return loaded
    }
  } catch (e) {
    console.error('Columns config yüklənərkən xəta:', e)
  }
  return defaultColumns
}

// localStorage-a columns saxla
const saveColumnsToStorage = (columns: ColumnConfig[]) => {
  try {
    localStorage.setItem('anbar-columns-config', JSON.stringify(columns))
  } catch (e) {
    console.error('Columns config saxlanarkən xəta:', e)
  }
}

// Tarix fərqini dəqiq hesabla (il, ay, gün)
const calculateDateDifference = (startDate: Date, endDate: Date): { years: number; months: number; days: number } => {
  let years = endDate.getFullYear() - startDate.getFullYear()
  let months = endDate.getMonth() - startDate.getMonth()
  let days = endDate.getDate() - startDate.getDate()
  
  // Günlər mənfi olarsa, əvvəlki ayın son günlərindən götür
  if (days < 0) {
    const lastDayOfPrevMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0).getDate()
    days += lastDayOfPrevMonth
    months--
  }
  
  // Aylar mənfi olarsa, əvvəlki ildən götür
  if (months < 0) {
    months += 12
    years--
  }
  
  return { years, months, days }
}

// Tarix fərqini formatla (il, ay, gün)
const formatDateDifference = (startDate: Date, endDate: Date): string => {
  const { years, months, days } = calculateDateDifference(startDate, endDate)
  const parts = []
  if (years > 0) parts.push(`${years} il`)
  if (months > 0) parts.push(`${months} ay`)
  if (days > 0) parts.push(`${days} gün`)
  
  if (parts.length === 0) {
    return '0 gün'
  }
  
  return parts.join(' ')
}

export default function Anbar() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRows, setSelectedRows] = useState<number[]>([])
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [showSettings, setShowSettings] = useState(false)
  // localStorage-dan papka ağacının görünürlüyünü yüklə (default: true - həmişə açıq)
  const loadCategoryTreeVisibility = (): boolean => {
    try {
      const saved = localStorage.getItem('anbar-category-tree-visible')
      if (saved !== null) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.error('Category tree visibility yüklənərkən xəta:', e)
    }
    return true // Default: açıq
  }

  const [showCategoryTree, setShowCategoryTree] = useState(loadCategoryTreeVisibility)
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [columns, setColumns] = useState<ColumnConfig[]>(loadColumnsFromStorage)
  const [sortConfig, setSortConfig] = useState<{ column: string | null; direction: 'asc' | 'desc' }>({
    column: null,
    direction: 'asc'
  })
  const [settingsTab, setSettingsTab] = useState<'columns' | 'functions'>('columns')
  
  // localStorage-dan funksiyalar ayarlarını yüklə
  const loadFunctionSettings = () => {
    try {
      const saved = localStorage.getItem('anbar-function-settings')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (e) {
      console.error('Function settings yüklənərkən xəta:', e)
    }
    return {
      multiSelect: true,
      ctrlClickMultiSelect: true,
      deleteEnabled: true
    }
  }

  const [functionSettings, setFunctionSettings] = useState(loadFunctionSettings())
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  
  // Kontekst menyu state-ləri
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    type: 'table' | 'category' | null
    categoryId?: number | null
  }>({
    visible: false,
    x: 0,
    y: 0,
    type: null
  })

  const loadProducts = useCallback(async (categoryId?: number | null) => {
    try {
      setLoading(true)
      const data = await productsAPI.getAll()
      // Frontend-də filtr et
      let filtered = data
      if (categoryId !== undefined && categoryId !== null) {
        filtered = data.filter(p => p.category_id === categoryId)
      }
      setProducts(filtered)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Məhsullar yüklənərkən xəta baş verdi')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCategories = useCallback(async () => {
    try {
      const data = await categoriesAPI.getAll()
      setCategories(data)
    } catch (err: any) {
      console.error('Categories yüklənərkən xəta:', err)
    }
  }, [])

  useEffect(() => {
    loadProducts(selectedCategoryId)
    loadCategories()
  }, [loadProducts, loadCategories, selectedCategoryId])

  // Hər gün tarixi yenilə (tarix hesablamaları üçün)
  useEffect(() => {
    const interval = setInterval(() => {
      // Hər saat yoxla, gün dəyişibsə yenilə
      const now = new Date()
      const currentHour = now.getHours()
      if (currentHour === 0) {
        // Gecə yarısı olduqda yenilə
        window.location.reload()
      }
    }, 1000 * 60 * 60) // Hər saat yoxla

    return () => clearInterval(interval)
  }, [])

  // Browser-in default kontekst menyusunu dayandır
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Yalnız cədvəl və papkalar üçün öz kontekst menyumuzu göstəririk
      // Digər yerlərdə browser-in default menyusunu tamamilə dayandırırıq
      e.preventDefault()
    }
    
    document.addEventListener('contextmenu', handleContextMenu)
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])

  // Kontekst menyunu bağla
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu.visible) {
        setContextMenu({ ...contextMenu, visible: false })
      }
    }
    
    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('click', handleClick)
    }
  }, [contextMenu])

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRows(products.map(p => p.id))
    } else {
      setSelectedRows([])
    }
  }

  const handleSelectRow = (id: number, event?: React.MouseEvent) => {
    const isCtrlPressed = event?.ctrlKey || event?.metaKey
    
    if (!functionSettings.multiSelect && !isCtrlPressed) {
      // Çoxlu seçim passivdirsə və Ctrl basılmamışsa, yalnız bu məhsulu seç
      setSelectedRows([id])
      return
    }

    if (functionSettings.ctrlClickMultiSelect && !isCtrlPressed) {
      // Ctrl basaraq seçim aktivdirsə və Ctrl basılmamışsa, yalnız bu məhsulu seç
      setSelectedRows([id])
      return
    }

    // Normal çoxlu seçim
    setSelectedRows(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

  // Ctrl+A ilə hamısını seç
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        if (functionSettings.multiSelect) {
          setSelectedRows(products.map(p => p.id))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [products, functionSettings.multiSelect])

  const handleDelete = async () => {
    if (selectedRows.length === 0) return
    if (!functionSettings.deleteEnabled) {
      alert('Delete funksiyası deaktivdir. Ayarlardan aktivləşdirin.')
      return
    }
    if (!confirm(`${selectedRows.length} məhsul silinsin?`)) return

    try {
      await Promise.all(selectedRows.map(id => productsAPI.delete(id.toString())))
      await loadProducts()
      setSelectedRows([])
    } catch (err: any) {
      alert('Silmə zamanı xəta baş verdi')
    }
  }

  // Delete düyməsi ilə silmə
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedRows.length > 0 && functionSettings.deleteEnabled) {
        e.preventDefault()
        if (!confirm(`${selectedRows.length} məhsul silinsin?`)) return

        try {
          await Promise.all(selectedRows.map(id => productsAPI.delete(id.toString())))
          await loadProducts()
          setSelectedRows([])
        } catch (err: any) {
          alert('Silmə zamanı xəta baş verdi')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedRows, functionSettings.deleteEnabled, loadProducts])

  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)
  const [barcodeScanMethod, setBarcodeScanMethod] = useState<'camera' | 'gallery' | null>(null)
  const [productFormData, setProductFormData] = useState({
    name: '',
    code: '',
    barcode: '',
    article: '',
    description: '',
    unit: 'ədəd',
    purchase_price: '',
    sale_price: '',
    category_id: '',
    type: '',
    brand: '',
    model: '',
    color: '',
    country: '',
    manufacturer: '',
    warranty_period: '',
    production_date: '',
    expiry_date: '',
    is_active: true
  })

  const handleEdit = () => {
    if (selectedRows.length === 1) {
      const product = products.find(p => p.id === selectedRows[0])
      if (product) {
        console.log('🔍 [DEBUG] Editing product:', product)
        console.log('🔍 [DEBUG] production_date:', product.production_date)
        console.log('🔍 [DEBUG] expiry_date:', product.expiry_date)
        
        setEditingProduct(product)
        
        // Tarixləri formatla
        let productionDateStr = ''
        let expiryDateStr = ''
        
        if (product.production_date) {
          try {
            const prodDate = new Date(product.production_date)
            if (!isNaN(prodDate.getTime())) {
              productionDateStr = prodDate.toISOString().split('T')[0]
            }
          } catch (e) {
            console.error('Production date parse error:', e)
          }
        }
        
        if (product.expiry_date) {
          try {
            const expDate = new Date(product.expiry_date)
            if (!isNaN(expDate.getTime())) {
              expiryDateStr = expDate.toISOString().split('T')[0]
            }
          } catch (e) {
            console.error('Expiry date parse error:', e)
          }
        }
        
        setProductFormData({
          name: product.name || '',
          code: product.code || '',
          barcode: product.barcode || '',
          article: product.article || '',
          description: product.description || '',
          unit: product.unit || 'ədəd',
          purchase_price: product.purchase_price?.toString() || '',
          sale_price: product.sale_price?.toString() || '',
          category_id: product.category_id?.toString() || '',
          type: product.type || '',
          brand: product.brand || '',
          model: product.model || '',
          color: product.color || '',
          country: product.country || '',
          manufacturer: product.manufacturer || '',
          warranty_period: product.warranty_period?.toString() || '',
          production_date: productionDateStr,
          expiry_date: expiryDateStr,
          is_active: product.is_active !== null ? product.is_active : true
        })
        
        console.log('🔍 [DEBUG] Form data set:', { production_date: productionDateStr, expiry_date: expiryDateStr })
        setShowProductModal(true)
      }
    }
  }

  // Avtomatik barkod generator
  const generateBarcode = () => {
    const timestamp = Date.now().toString()
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `BC${timestamp.slice(-8)}${random}`
  }

  // Barkod dəyişdikdə kodu avtomatik təyin et
  const handleBarcodeChange = (barcode: string) => {
    setProductFormData(prev => {
      let code = prev.code
      // Əgər barkod varsa və kod boşdursa, barkodun son 6 rəqəmini kod kimi istifadə et
      if (barcode && barcode.length >= 6 && !prev.code) {
        code = barcode.slice(-6)
      }
      return { ...prev, barcode, code }
    })
  }

  // Barkod yoxdursa avtomatik yarat
  const handleAutoGenerateBarcode = () => {
    // Mövcud barkodların siyahısını yoxla
    const existingBarcodes = products.map(p => p.barcode).filter(Boolean)
    let newBarcode = generateBarcode()
    
    // Unikal barkod yarat
    while (existingBarcodes.includes(newBarcode)) {
      newBarcode = generateBarcode()
    }
    
    handleBarcodeChange(newBarcode)
  }

  // Barkod oxuma funksiyaları
  const handleBarcodeScanFromCamera = async () => {
    try {
      // Kamera istifadəsi üçün browser API
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Arxa kamera
      })
      
      // Burada barkod oxuyucu kitabxanası istifadə edilməlidir
      // Məsələn: html5-qrcode, jsbarcode, quaggaJS və s.
      // Sadəlik üçün alert göstəririk
      alert('Kamera açıldı. Barkod oxuyucu kitabxanası quraşdırılmalıdır.')
      
      // Stream-i dayandır
      stream.getTracks().forEach(track => track.stop())
    } catch (err) {
      alert('Kamera istifadəsi mümkün deyil: ' + (err as Error).message)
    }
  }

  const handleBarcodeScanFromGallery = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        // Şəkildən barkod oxuma
        // Burada barkod oxuyucu kitabxanası istifadə edilməlidir
        alert('Şəkildən barkod oxuma funksiyası quraşdırılmalıdır.')
      }
    }
    input.click()
  }

  const handleAddNew = () => {
    setEditingProduct(null)
    setProductFormData({
      name: '',
      code: '',
      barcode: '',
      article: '',
      description: '',
      unit: 'ədəd',
      purchase_price: '',
      sale_price: '',
      category_id: selectedCategoryId?.toString() || '',
      type: '',
      brand: '',
      model: '',
      color: '',
      country: '',
      manufacturer: '',
      warranty_period: '',
      production_date: '',
      expiry_date: '',
      is_active: true
    })
    setShowProductModal(true)
  }

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!productFormData.name.trim()) {
      alert('Məhsul adı məcburidir')
      return
    }

    try {
      if (editingProduct) {
        // Redaktə
        // Barkod unikallığını yoxla
        if (productFormData.barcode) {
          const existingProduct = products.find(p => 
            p.barcode === productFormData.barcode && p.id !== editingProduct.id
          )
          if (existingProduct) {
            alert('Bu barkod artıq istifadə olunub!')
            return
          }
        }

        await productsAPI.update(editingProduct.id.toString(), {
          name: productFormData.name,
          code: productFormData.code || undefined,
          barcode: productFormData.barcode || undefined,
          article: productFormData.article || undefined,
          description: productFormData.description || undefined,
          unit: productFormData.unit,
          purchase_price: productFormData.purchase_price ? parseFloat(productFormData.purchase_price) : 0,
          sale_price: productFormData.sale_price ? parseFloat(productFormData.sale_price) : 0,
          category_id: productFormData.category_id ? parseInt(productFormData.category_id) : null,
          type: productFormData.type || undefined,
          brand: productFormData.brand || undefined,
          model: productFormData.model || undefined,
          color: productFormData.color || undefined,
          country: productFormData.country || undefined,
          manufacturer: productFormData.manufacturer || undefined,
          warranty_period: (() => {
            // Zəmanət müddətini istehsal və bitmə tarixlərindən hesabla (ay)
            if (productFormData.production_date && productFormData.expiry_date) {
              try {
                const productionDate = new Date(productFormData.production_date + 'T00:00:00')
                const expiryDate = new Date(productFormData.expiry_date + 'T00:00:00')
                if (!isNaN(productionDate.getTime()) && !isNaN(expiryDate.getTime())) {
                  const { years, months, days } = calculateDateDifference(productionDate, expiryDate)
                  // Ümumi ayları hesabla (il * 12 + ay, günlər 0.5 aydan çox olarsa +1 ay)
                  const totalMonths = years * 12 + months + (days >= 15 ? 1 : 0)
                  return totalMonths > 0 ? totalMonths : undefined
                }
              } catch (e) {
                // Xəta olduqda undefined qaytar
                console.error('Zəmanət müddəti hesablanarkən xəta:', e)
              }
            }
            return undefined
          })(),
          production_date: productFormData.production_date ? new Date(productFormData.production_date + 'T00:00:00').toISOString() : undefined,
          expiry_date: productFormData.expiry_date ? new Date(productFormData.expiry_date + 'T00:00:00').toISOString() : undefined,
          is_active: productFormData.is_active
        })
      } else {
        // Barkod yoxdursa avtomatik yarat
        let finalBarcode = productFormData.barcode
        if (!finalBarcode) {
          finalBarcode = generateBarcode()
          const existingBarcodes = products.map(p => p.barcode).filter(Boolean)
          while (existingBarcodes.includes(finalBarcode)) {
            finalBarcode = generateBarcode()
          }
        } else {
          // Barkod unikallığını yoxla
          const existingProduct = products.find(p => p.barcode === finalBarcode)
          if (existingProduct) {
            alert('Bu barkod artıq istifadə olunub!')
            return
          }
        }

        // Kod yoxdursa barkodun son 6 rəqəmini istifadə et
        let finalCode = productFormData.code
        if (!finalCode && finalBarcode && finalBarcode.length >= 6) {
          finalCode = finalBarcode.slice(-6)
        }

        // Yeni məhsul
        await productsAPI.create({
          name: productFormData.name,
          code: finalCode || undefined,
          barcode: finalBarcode || undefined,
          article: productFormData.article || undefined,
          description: productFormData.description || undefined,
          unit: productFormData.unit,
          purchase_price: productFormData.purchase_price ? parseFloat(productFormData.purchase_price) : 0,
          sale_price: productFormData.sale_price ? parseFloat(productFormData.sale_price) : 0,
          category_id: productFormData.category_id ? parseInt(productFormData.category_id) : null,
          type: productFormData.type || undefined,
          brand: productFormData.brand || undefined,
          model: productFormData.model || undefined,
          color: productFormData.color || undefined,
          country: productFormData.country || undefined,
          manufacturer: productFormData.manufacturer || undefined,
          warranty_period: (() => {
            // Zəmanət müddətini istehsal və bitmə tarixlərindən hesabla (ay)
            if (productFormData.production_date && productFormData.expiry_date) {
              try {
                const productionDate = new Date(productFormData.production_date + 'T00:00:00')
                const expiryDate = new Date(productFormData.expiry_date + 'T00:00:00')
                if (!isNaN(productionDate.getTime()) && !isNaN(expiryDate.getTime())) {
                  const { years, months, days } = calculateDateDifference(productionDate, expiryDate)
                  // Ümumi ayları hesabla (il * 12 + ay, günlər 0.5 aydan çox olarsa +1 ay)
                  const totalMonths = years * 12 + months + (days >= 15 ? 1 : 0)
                  return totalMonths > 0 ? totalMonths : undefined
                }
              } catch (e) {
                // Xəta olduqda undefined qaytar
                console.error('Zəmanət müddəti hesablanarkən xəta:', e)
              }
            }
            return undefined
          })(),
          production_date: productFormData.production_date ? new Date(productFormData.production_date + 'T00:00:00').toISOString() : undefined,
          expiry_date: productFormData.expiry_date ? new Date(productFormData.expiry_date + 'T00:00:00').toISOString() : undefined,
          is_active: productFormData.is_active
        })
      }
      
      await loadProducts(selectedCategoryId)
      setShowProductModal(false)
      setSelectedRows([])
    } catch (err: any) {
      alert(err.response?.data?.message || 'Məhsul saxlanarkən xəta baş verdi')
    }
  }

  const handleCopy = () => {
    if (selectedRows.length === 1) {
      // Bir məhsul seçildikdə kopyala modalı aç
      const product = products.find(p => p.id === selectedRows[0])
      if (product) {
        setEditingProduct(null) // Yeni məhsul kimi
        setProductFormData({
          name: product.name || '',
          code: '', // Kod boş
          barcode: '', // Barkod boş
          article: product.article || '',
          description: product.description || '',
          unit: product.unit || 'ədəd',
          purchase_price: product.purchase_price?.toString() || '',
          sale_price: product.sale_price?.toString() || '',
          category_id: product.category_id?.toString() || '',
          type: product.type || '',
          brand: product.brand || '',
          model: product.model || '',
          color: product.color || '',
          country: product.country || '',
          manufacturer: product.manufacturer || '',
          warranty_period: product.warranty_period?.toString() || '',
          production_date: (() => {
            if (product.production_date) {
              try {
                const prodDate = new Date(product.production_date)
                if (!isNaN(prodDate.getTime())) {
                  return prodDate.toISOString().split('T')[0]
                }
              } catch (e) {
                console.error('Production date parse error:', e)
              }
            }
            return ''
          })(),
          expiry_date: (() => {
            if (product.expiry_date) {
              try {
                const expDate = new Date(product.expiry_date)
                if (!isNaN(expDate.getTime())) {
                  return expDate.toISOString().split('T')[0]
                }
              } catch (e) {
                console.error('Expiry date parse error:', e)
              }
            }
            return ''
          })(),
          is_active: product.is_active !== null ? product.is_active : true
        })
        setShowProductModal(true)
      }
    } else {
      // Çoxlu məhsul seçildikdə mətn kimi kopyala
      const selectedProducts = products.filter(p => selectedRows.includes(p.id))
      const text = selectedProducts.map(p => 
        `${p.name}\t${p.code || ''}\t${p.sale_price || 0}\t${(p as any).warehouse?.[0]?.quantity || 0}`
      ).join('\n')
      navigator.clipboard.writeText(text)
      alert('Kopyalandı!')
    }
  }

  const handlePrint = () => {
    // Seçilmiş məhsulları və ya bütün məhsulları göstər
    const productsToPrint = selectedRows.length > 0 
      ? sortedProducts.filter(p => selectedRows.includes(p.id))
      : sortedProducts

    if (productsToPrint.length === 0) {
      alert('Çap üçün məhsul seçilməyib')
      return
    }

    // Çap üçün HTML yarat
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    // Cəmləri hesabla
    let totalQuantity = 0
    
    productsToPrint.forEach(product => {
      const quantity = parseFloat(getWarehouseQuantity(product).toString())
      totalQuantity += quantity
    })

    // Görünən sütunlar
    const visibleCols = sortedColumns.filter(col => col.visible && col.id !== 'checkbox')

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Anbar - Çap</title>
          <style>
            @media print {
              @page { margin: 1cm; }
              body { margin: 0; }
            }
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
            }
            h1 {
              text-align: center;
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            .text-right {
              text-align: right;
            }
            .summary {
              margin-top: 20px;
              padding: 15px;
              background-color: #f8f9fa;
              border: 1px solid #ddd;
              border-radius: 4px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
              font-size: 16px;
            }
            .summary-total {
              font-weight: bold;
              font-size: 18px;
              color: #007bff;
              border-top: 2px solid #007bff;
              padding-top: 10px;
              margin-top: 10px;
            }
          </style>
        </head>
        <body>
          <h1>Anbar - Məhsul Siyahısı</h1>
          <table>
            <thead>
              <tr>
                ${visibleCols.map(col => `<th>${col.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${productsToPrint.map(product => {
                const quantity = getWarehouseQuantity(product)
                const salePrice = parseFloat(product.sale_price?.toString() || '0')
                const qty = parseFloat(quantity.toString())
                const total = salePrice * qty
                
                return `
                  <tr>
                    ${visibleCols.map(col => {
                      let value = ''
                      switch (col.id) {
                        case 'id':
                          value = product.id.toString()
                          break
                        case 'name':
                          value = product.name || '-'
                          break
                        case 'code':
                          value = product.code || '-'
                          break
                        case 'barcode':
                          value = product.barcode || '-'
                          break
                        case 'unit':
                          value = product.unit || 'ədəd'
                          break
                        case 'purchase_price':
                          value = `${product.purchase_price || 0} AZN`
                          break
                        case 'sale_price':
                          value = `${product.sale_price || 0} AZN`
                          break
                        case 'quantity':
                          value = `${quantity} ${product.unit || 'ədəd'}`
                          break
                        case 'purchase_total':
                          const purchaseTotal = parseFloat(product.purchase_price?.toString() || '0') * qty
                          value = `${purchaseTotal.toFixed(2)} AZN`
                          break
                        case 'sale_total':
                          const saleTotal = parseFloat(product.sale_price?.toString() || '0') * qty
                          value = `${saleTotal.toFixed(2)} AZN`
                          break
                        default:
                          value = '-'
                      }
                      const alignClass = (col.id.includes('price') || col.id === 'quantity' || col.id === 'purchase_total' || col.id === 'sale_total') ? 'text-right' : ''
                      return `<td class="${alignClass}">${value}</td>`
                    }).join('')}
                  </tr>
                `
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background-color: #f2f2f2; font-weight: bold;">
                ${visibleCols.map(col => {
                  let value = ''
                  switch (col.id) {
                    case 'name':
                      value = 'Cəmi:'
                      break
                    case 'purchase_price':
                      // Alış qiyməti sütununun altında: sadəcə alış qiymətlərinin cəmi (qalıqla vurulmur)
                      const totalPurchasePrice = productsToPrint.reduce((sum, p) => {
                        const price = parseFloat(p.purchase_price?.toString() || '0')
                        return sum + price
                      }, 0)
                      value = `${totalPurchasePrice.toFixed(2)} AZN`
                      break
                    case 'sale_price':
                      // Satış qiyməti sütununun altında: sadəcə satış qiymətlərinin cəmi (qalıqla vurulmur)
                      const totalSalePrice = productsToPrint.reduce((sum, p) => {
                        const price = parseFloat(p.sale_price?.toString() || '0')
                        return sum + price
                      }, 0)
                      value = `${totalSalePrice.toFixed(2)} AZN`
                      break
                    case 'quantity':
                      value = totalQuantity.toFixed(2)
                      break
                    case 'purchase_total':
                      const totalPurchaseSum = productsToPrint.reduce((sum, p) => {
                        const qty = parseFloat(getWarehouseQuantity(p).toString())
                        const price = parseFloat(p.purchase_price?.toString() || '0')
                        return sum + (price * qty)
                      }, 0)
                      value = `${totalPurchaseSum.toFixed(2)} AZN`
                      break
                    case 'sale_total':
                      const totalSaleSum = productsToPrint.reduce((sum, p) => {
                        const qty = parseFloat(getWarehouseQuantity(p).toString())
                        const salePrice = parseFloat(p.sale_price?.toString() || '0')
                        return sum + (salePrice * qty)
                      }, 0)
                      value = `${totalSaleSum.toFixed(2)} AZN`
                      break
                    default:
                      value = ''
                  }
                  const alignClass = (col.id.includes('price') || col.id === 'quantity' || col.id === 'purchase_total' || col.id === 'sale_total') ? 'text-right' : ''
                  return `<td class="${alignClass}">${value}</td>`
                }).join('')}
              </tr>
            </tfoot>
          </table>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
    
    // Çap pəncərəsini aç
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  // Filtr və axtarış
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const getWarehouseQuantity = (product: Product) => {
    return (product as any).warehouse?.[0]?.quantity || 0
  }

  // Sütun idarəetmə funksiyaları
  const toggleColumnVisibility = (columnId: string) => {
    setColumns(prev => {
      const newColumns = prev.map(col =>
        col.id === columnId ? { ...col, visible: !col.visible } : col
      )
      saveColumnsToStorage(newColumns)
      return newColumns
    })
  }

  const updateColumnWidth = (columnId: string, width: number) => {
    if (width < 50) width = 50 // Minimum genişlik
    if (width > 500) width = 500 // Maksimum genişlik
    setColumns(prev => {
      const newColumns = prev.map(col =>
        col.id === columnId ? { ...col, width } : col
      )
      saveColumnsToStorage(newColumns)
      return newColumns
    })
  }

  const moveColumn = (columnId: string, direction: 'up' | 'down') => {
    setColumns(prev => {
      const index = prev.findIndex(col => col.id === columnId)
      if (index === -1) return prev
      
      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= prev.length) return prev

      const newColumns = [...prev]
      const [moved] = newColumns.splice(index, 1)
      newColumns.splice(newIndex, 0, moved)
      
      // Order-ləri yenilə
      const updatedColumns = newColumns.map((col, idx) => ({ ...col, order: idx }))
      saveColumnsToStorage(updatedColumns)
      return updatedColumns
    })
  }

  const resetColumns = () => {
    setColumns(defaultColumns)
    saveColumnsToStorage(defaultColumns)
  }

  const updateFunctionSettings = (key: string, value: boolean) => {
    const newSettings = { ...functionSettings, [key]: value }
    setFunctionSettings(newSettings)
    try {
      localStorage.setItem('anbar-function-settings', JSON.stringify(newSettings))
    } catch (e) {
      console.error('Function settings saxlanarkən xəta:', e)
    }
  }

  // Sort funksiyası
  const handleSort = (columnId: string) => {
    setSortConfig(prev => {
      if (prev.column === columnId) {
        // Eyni sütuna kliklədikdə istiqaməti dəyişdir
        return {
          column: columnId,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        }
      } else {
        // Yeni sütuna kliklədikdə artan sırala
        return {
          column: columnId,
          direction: 'asc'
        }
      }
    })
  }

  // Sıralanmış məhsullar
  const getSortedProducts = () => {
    if (!sortConfig.column) return filteredProducts

    return [...filteredProducts].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortConfig.column) {
        case 'id':
          aValue = a.id
          bValue = b.id
          break
        case 'name':
          aValue = a.name?.toLowerCase() || ''
          bValue = b.name?.toLowerCase() || ''
          break
        case 'code':
          aValue = a.code?.toLowerCase() || ''
          bValue = b.code?.toLowerCase() || ''
          break
        case 'barcode':
          aValue = a.barcode?.toLowerCase() || ''
          bValue = b.barcode?.toLowerCase() || ''
          break
        case 'unit':
          aValue = a.unit?.toLowerCase() || ''
          bValue = b.unit?.toLowerCase() || ''
          break
        case 'purchase_price':
          aValue = parseFloat(a.purchase_price?.toString() || '0')
          bValue = parseFloat(b.purchase_price?.toString() || '0')
          break
        case 'sale_price':
          aValue = parseFloat(a.sale_price?.toString() || '0')
          bValue = parseFloat(b.sale_price?.toString() || '0')
          break
        case 'quantity':
          aValue = parseFloat(getWarehouseQuantity(a).toString())
          bValue = parseFloat(getWarehouseQuantity(b).toString())
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }

  const sortedProducts = getSortedProducts()

  // Sütunları sırala
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order)

  // Sütun sürüşdürmə funksiyaları
  const handleDragStart = (columnId: string) => {
    setDraggedColumn(columnId)
  }

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault()
    e.stopPropagation()
    // Yalnız visual feedback üçün, real yenidən sıralama handleDrop-da olacaq
  }

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (draggedColumn === null || draggedColumn === targetColumnId) {
      setDraggedColumn(null)
      return
    }

    // Bütün sütunları yenidən sırala
    const allColumns = [...columns]
    const draggedCol = allColumns.find(col => col.id === draggedColumn)
    const targetCol = allColumns.find(col => col.id === targetColumnId)

    if (!draggedCol || !targetCol) {
      setDraggedColumn(null)
      return
    }

    // Yalnız görünən sütunları nəzərə al
    const visibleColumns = sortedColumns.filter(col => col.visible)
    const draggedIndex = visibleColumns.findIndex(col => col.id === draggedColumn)
    const targetIndex = visibleColumns.findIndex(col => col.id === targetColumnId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedColumn(null)
      return
    }

    // Sütunları yenidən sırala
    const newColumns = [...allColumns]
    const draggedOrder = draggedCol.order
    const targetOrder = targetCol.order

    // Sütunları yenidən sırala
    newColumns.forEach(col => {
      if (col.id === draggedColumn) {
        col.order = targetOrder
      } else if (draggedOrder < targetOrder) {
        // Aşağıdan yuxarıya sürüşdürülür
        if (col.order > draggedOrder && col.order <= targetOrder) {
          col.order = col.order - 1
        }
      } else {
        // Yuxarıdan aşağıya sürüşdürülür
        if (col.order >= targetOrder && col.order < draggedOrder) {
          col.order = col.order + 1
        }
      }
    })

    const updatedColumns = newColumns.map((col) => ({ ...col, order: col.order }))
    setColumns(updatedColumns)
    saveColumnsToStorage(updatedColumns)
    setDraggedColumn(null)
  }

  const handleDragEnd = () => {
    setDraggedColumn(null)
  }

  // Sütun genişliyini sürüşdürmə funksiyaları
  const handleResizeStart = (e: React.MouseEvent, columnId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(columnId)
    setResizeStartX(e.clientX)
    const column = sortedColumns.find(col => col.id === columnId)
    if (column) {
      setResizeStartWidth(column.width)
    }
  }

  useEffect(() => {
    if (!resizingColumn) return

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - resizeStartX
      const newWidth = Math.max(50, Math.min(500, resizeStartWidth + diff))
      
      setColumns(prev => {
        const updated = prev.map(col =>
          col.id === resizingColumn ? { ...col, width: newWidth } : col
        )
        saveColumnsToStorage(updated)
        return updated
      })
    }

    const handleMouseUp = () => {
      setResizingColumn(null)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingColumn, resizeStartX, resizeStartWidth])

  // Kateqoriya ağacını qur
  const buildCategoryTree = (categories: Category[], parentId: number | null = null): Category[] => {
    return categories
      .filter(cat => cat.parent_id === parentId)
      .map(cat => ({
        ...cat,
        children: buildCategoryTree(categories, cat.id)
      }))
  }

  const categoryTree = buildCategoryTree(categories)

  // Məhsulları kateqoriyaya köçür
  const handleMoveToCategory = async (productIds: number[], categoryId: number | null) => {
    if (productIds.length === 0) {
      alert('Məhsul seçin')
      return
    }

    try {
      await categoriesAPI.moveProducts(productIds, categoryId)
      await loadProducts(selectedCategoryId)
      setSelectedRows([])
      alert('Məhsullar köçürüldü')
    } catch (err: any) {
      alert('Köçürmə zamanı xəta baş verdi')
    }
  }

  // Papka redaktə et
  const handleEditCategory = async (category: Category) => {
    const newName = prompt('Papka adını dəyişdirin:', category.name)
    if (newName && newName.trim() && newName !== category.name) {
      try {
        await categoriesAPI.update(category.id.toString(), { name: newName.trim() })
        await loadCategories()
      } catch (err: any) {
        alert('Papka adı dəyişdirilərkən xəta baş verdi')
      }
    }
  }

  // Papka sil
  const handleDeleteCategory = async (category: Category) => {
    const productCount = category._count?.products || 0
    if (productCount > 0) {
      if (!confirm(`Bu papkada ${productCount} məhsul var. Papkanı silmək istəyirsiniz?`)) {
        return
      }
    } else {
      if (!confirm(`"${category.name}" papkasını silmək istəyirsiniz?`)) {
        return
      }
    }

    try {
      await categoriesAPI.delete(category.id.toString())
      await loadCategories()
      if (selectedCategoryId === category.id) {
        setSelectedCategoryId(null)
      }
    } catch (err: any) {
      alert('Papka silinərkən xəta baş verdi')
    }
  }

  // Papkanı başqa papkaya köçür
  const handleMoveCategory = async (category: Category) => {
    // Bütün mövcud papkaları göstər (özü və valideynlərini istisna et)
    const availableCategories = categories.filter(cat => 
      cat.id !== category.id && 
      !isCategoryDescendant(categories, cat.id, category.id)
    )
    
    if (availableCategories.length === 0) {
      alert('Başqa papka yoxdur')
      return
    }

    const categoryList = availableCategories.map(cat => {
      const path = getCategoryPath(categories, cat.id)
      return `${cat.id}: ${path}`
    }).join('\n')

    const input = prompt(
      `Papkanı köçürmək üçün valideyn papka ID-sini daxil edin (boş buraxın - kök səviyyəyə köçürmək üçün):\n\n${categoryList}`
    )

    if (input === null) return // İstifadəçi ləğv etdi

    const newParentId = input.trim() === '' ? null : parseInt(input.trim())
    
    if (newParentId !== null && isNaN(newParentId)) {
      alert('Yanlış ID')
      return
    }

    if (newParentId === category.parent_id) {
      return // Dəyişiklik yoxdur
    }

    try {
      await categoriesAPI.update(category.id.toString(), { parent_id: newParentId })
      await loadCategories()
    } catch (err: any) {
      alert('Papka köçürülərkən xəta baş verdi')
    }
  }

  // Alt papka yarat
  const handleCreateSubCategory = async (parentCategory: Category) => {
    const name = prompt('Alt papka adı:', '')
    if (name && name.trim()) {
      try {
        await categoriesAPI.create({ name: name.trim(), parent_id: parentCategory.id })
        await loadCategories()
      } catch (err: any) {
        alert('Alt papka yaradılarkən xəta baş verdi')
      }
    }
  }

  // Papka yolunu tap
  const getCategoryPath = (categories: Category[], categoryId: number): string => {
    const category = categories.find(c => c.id === categoryId)
    if (!category) return ''
    
    if (category.parent_id === null) {
      return category.name
    }
    
    const parentPath = getCategoryPath(categories, category.parent_id)
    return parentPath ? `${parentPath} > ${category.name}` : category.name
  }

  // Papka nəslini yoxla (descendant)
  const isCategoryDescendant = (categories: Category[], categoryId: number, ancestorId: number): boolean => {
    const category = categories.find(c => c.id === categoryId)
    if (!category || category.parent_id === null) return false
    if (category.parent_id === ancestorId) return true
    return isCategoryDescendant(categories, category.parent_id, ancestorId)
  }

  // localStorage-dan açıq papkaları yüklə
  const loadExpandedCategories = (): Set<number> => {
    try {
      const saved = localStorage.getItem('anbar-expanded-categories')
      if (saved) {
        return new Set(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Expanded categories yüklənərkən xəta:', e)
    }
    return new Set()
  }

  // localStorage-a açıq papkaları saxla
  const saveExpandedCategories = (expanded: Set<number>) => {
    try {
      localStorage.setItem('anbar-expanded-categories', JSON.stringify(Array.from(expanded)))
    } catch (e) {
      console.error('Expanded categories saxlanarkən xəta:', e)
    }
  }

  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(loadExpandedCategories)

  // Qeyd: selectedCategoryId həmişə null ilə başlayır (Bütün məhsullar aktiv)
  // localStorage-də saxlanmır, çünki səhifə yenilənəndə həmişə "Bütün məhsullar" aktiv olmalıdır

  // Papka ağacının görünürlüyünü localStorage-a saxla
  useEffect(() => {
    try {
      localStorage.setItem('anbar-category-tree-visible', JSON.stringify(showCategoryTree))
    } catch (e) {
      console.error('Category tree visibility saxlanarkən xəta:', e)
    }
  }, [showCategoryTree])

  // Kateqoriya ağacı komponenti
  const CategoryTreeItem = ({ category, level = 0 }: { category: Category; level?: number }) => {
    const isExpanded = expandedCategories.has(category.id)
    const isSelected = selectedCategoryId === category.id
    const productCount = category._count?.products || 0

    const toggleExpanded = () => {
      const newExpanded = new Set(expandedCategories)
      if (isExpanded) {
        newExpanded.delete(category.id)
      } else {
        newExpanded.add(category.id)
      }
      setExpandedCategories(newExpanded)
      saveExpandedCategories(newExpanded)
    }

    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.5rem',
            paddingLeft: `${level * 1.5 + 0.5}rem`,
            background: isSelected ? '#e7f3ff' : 'transparent',
            cursor: 'pointer',
            borderRadius: '4px',
            marginBottom: '0.25rem',
            position: 'relative',
            border: isSelected ? '2px solid #007bff' : '1px solid transparent',
            transition: 'all 0.2s ease'
          }}
          onClick={(e) => {
            // Icon-lara kliklədikdə expand/collapse
            if ((e.target as HTMLElement).closest('.category-icon')) {
              toggleExpanded()
            } else {
              setSelectedCategoryId(isSelected ? null : category.id)
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setContextMenu({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              type: 'category',
              categoryId: category.id
            })
            setSelectedCategoryId(category.id)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.style.background = '#d0e7ff'
          }}
          onDragLeave={(e) => {
            e.currentTarget.style.background = isSelected ? '#e7f3ff' : 'transparent'
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.style.background = isSelected ? '#e7f3ff' : 'transparent'
            const productId = e.dataTransfer.getData('productId')
            if (productId) {
              handleMoveToCategory([parseInt(productId)], category.id)
            } else {
              handleMoveToCategory(selectedRows, category.id)
            }
          }}
        >
          <span 
            className="category-icon"
            style={{ marginRight: '0.5rem', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              toggleExpanded()
            }}
          >
            {category.children && category.children.length > 0 ? (isExpanded ? '📂' : '📁') : '📄'}
          </span>
          <span style={{ flex: 1, fontWeight: isSelected ? 'bold' : 'normal' }}>{category.name}</span>
          <span style={{ fontSize: '0.85rem', color: '#666', marginRight: '0.5rem' }}>
            ({productCount})
          </span>
          
          {/* Məhsul köçürmə düyməsi */}
          {selectedRows.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleMoveToCategory(selectedRows, category.id)
              }}
              style={{
                padding: '0.25rem 0.5rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.75rem'
              }}
              title="Seçilmiş məhsulları bura köçür"
            >
              →
            </button>
          )}
        </div>
        {isExpanded && category.children && category.children.map(child => (
          <CategoryTreeItem key={child.id} category={child} level={level + 1} />
        ))}
      </div>
    )
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div style={{ display: 'flex', gap: '1rem', padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
          {/* Papka Ağacı */}
          {showCategoryTree && (
            <div style={{
              width: '300px',
              background: '#f8f9fa',
              borderRadius: '8px',
              padding: '1rem',
              border: '1px solid #ddd',
              maxHeight: 'calc(100vh - 200px)',
              overflow: 'auto',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Papkalar</h3>
                <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                  {/* Yeni papka */}
                  <button
                    onClick={() => {
                      const name = prompt('Yeni papka adı:')
                      if (name && name.trim()) {
                        categoriesAPI.create({ name: name.trim() }).then(() => loadCategories()).catch(() => {
                          alert('Papka yaradılarkən xəta baş verdi')
                        })
                      }
                    }}
                    style={{
                      padding: '0.25rem 0.4rem',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      lineHeight: '1'
                    }}
                    title="Yeni papka"
                  >
                    ➕
                  </button>
                  
                  {/* Seçilmiş papka üçün əməliyyatlar */}
                  {selectedCategoryId !== null && (
                    <>
                      {/* Alt papka yarat */}
                      <button
                        onClick={() => {
                          const category = categories.find(c => c.id === selectedCategoryId)
                          if (category) {
                            handleCreateSubCategory(category)
                          }
                        }}
                        style={{
                          padding: '0.25rem 0.4rem',
                          background: '#17a2b8',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          lineHeight: '1'
                        }}
                        title="Alt papka yarat"
                      >
                        ➕
                      </button>
                      
                      {/* Redaktə */}
                      <button
                        onClick={() => {
                          const category = categories.find(c => c.id === selectedCategoryId)
                          if (category) {
                            handleEditCategory(category)
                          }
                        }}
                        style={{
                          padding: '0.25rem 0.4rem',
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          lineHeight: '1'
                        }}
                        title="Papka adını redaktə et"
                      >
                        ✏️
                      </button>
                      
                      {/* Köçür */}
                      <button
                        onClick={() => {
                          const category = categories.find(c => c.id === selectedCategoryId)
                          if (category) {
                            handleMoveCategory(category)
                          }
                        }}
                        style={{
                          padding: '0.25rem 0.4rem',
                          background: '#ffc107',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          lineHeight: '1'
                        }}
                        title="Papkanı köçür"
                      >
                        📦
                      </button>
                      
                      {/* Sil */}
                      <button
                        onClick={() => {
                          const category = categories.find(c => c.id === selectedCategoryId)
                          if (category) {
                            handleDeleteCategory(category)
                          }
                        }}
                        style={{
                          padding: '0.25rem 0.4rem',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          lineHeight: '1'
                        }}
                        title="Papkanı sil"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <div
                style={{
                  padding: '0.5rem',
                  background: selectedCategoryId === null ? '#e7f3ff' : 'transparent',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  marginBottom: '0.5rem',
                  fontWeight: selectedCategoryId === null ? 'bold' : 'normal',
                  border: selectedCategoryId === null ? '2px solid #007bff' : '1px solid transparent',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setSelectedCategoryId(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  const productId = e.dataTransfer.getData('productId')
                  if (productId) {
                    handleMoveToCategory([parseInt(productId)], null)
                  } else {
                    handleMoveToCategory(selectedRows, null)
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                📦 Bütün məhsullar
              </div>

              {categoryTree.map(category => (
                <CategoryTreeItem key={category.id} category={category} />
              ))}
            </div>
          )}

          {/* Əsas Məzmun */}
          <div style={{ flex: 1 }}>
          <h1 style={{ marginBottom: '1.5rem' }}>Anbar</h1>

          {/* Toolbar */}
          <div style={{
            background: '#f5f5f5',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            border: '1px solid #ddd'
          }}>
            {/* Axtarış */}
            <div style={{ flex: '1', minWidth: '200px' }}>
              <input
                type="text"
                placeholder="🔍 Axtarış..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem'
                }}
              />
            </div>

            {/* Filtr */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem'
              }}
            >
              <option value="">Bütün kateqoriyalar</option>
              <option value="low">Az qalıq</option>
              <option value="out">Qalıq yoxdur</option>
            </select>

            {/* Toolbar düymələri */}
            {/* Bütün məhsullar - yalnız papka seçildikdə görünür */}
            {selectedCategoryId !== null && (
              <button
                onClick={() => setSelectedCategoryId(null)}
                style={{
                  padding: '0.5rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Bütün məhsullar"
              >
                📦
              </button>
            )}

            {/* Papkalar - sadəcə icon */}
            <button
              onClick={() => setShowCategoryTree(!showCategoryTree)}
              style={{
                padding: '0.5rem',
                background: showCategoryTree ? '#007bff' : '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1.2rem',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Papka ağacı"
            >
              📁
            </button>

            <button
              onClick={handleAddNew}
              style={{
                padding: '0.5rem 1rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 'bold'
              }}
              title="Yeni məhsul əlavə et"
            >
              ➕ Yeni Məhsul
            </button>

            <button
              onClick={() => setShowSettings(true)}
              style={{
                padding: '0.5rem 1rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
              title="Ayarlar"
            >
              ⚙️ Ayarlar
            </button>

            <button
              onClick={handleEdit}
              disabled={selectedRows.length !== 1}
              style={{
                padding: '0.5rem 1rem',
                background: selectedRows.length === 1 ? '#007bff' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: selectedRows.length === 1 ? 'pointer' : 'not-allowed',
                fontSize: '0.9rem'
              }}
              title={selectedRows.length === 1 ? 'Redaktə' : 'Bir məhsul seçin'}
            >
              ✏️ Redaktə
            </button>

            <button
              onClick={handleDelete}
              disabled={selectedRows.length === 0}
              style={{
                padding: '0.5rem 1rem',
                background: selectedRows.length > 0 ? '#dc3545' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: selectedRows.length > 0 ? 'pointer' : 'not-allowed',
                fontSize: '0.9rem'
              }}
              title="Sil"
            >
              🗑️ Sil
            </button>

            <button
              onClick={handleCopy}
              disabled={selectedRows.length === 0}
              style={{
                padding: '0.5rem 1rem',
                background: selectedRows.length > 0 ? '#28a745' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: selectedRows.length > 0 ? 'pointer' : 'not-allowed',
                fontSize: '0.9rem'
              }}
              title={selectedRows.length === 1 ? 'Məhsulu kopyala (barkod və kod boş olacaq)' : 'Məhsulları kopyala'}
            >
              📋 Kopyala
            </button>

            <button
              onClick={handlePrint}
              style={{
                padding: '0.5rem 1rem',
                background: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
              title="Çap et"
            >
              🖨️ Çap
            </button>
          </div>

          {/* Cədvəl */}
          {loading && <p>Yüklənir...</p>}
          {error && (
            <div style={{ background: '#ffebee', color: '#c62828', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          {!loading && !error && (
            <div 
              style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: '8px' }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setContextMenu({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  type: 'table'
                })
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    {sortedColumns.map((column) => {
                      if (!column.visible && column.id !== 'checkbox') return null
                      
                      if (column.id === 'checkbox') {
                        return (
                          <th
                            key={column.id}
                            style={{
                              padding: '0.75rem',
                              textAlign: 'left',
                              borderRight: '1px solid #dee2e6',
                              width: column.width
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedRows.length === products.length && products.length > 0}
                              onChange={handleSelectAll}
                            />
                          </th>
                        )
                      }

                      const getAlign = () => {
                        if (column.id.includes('price') || column.id === 'quantity') return 'right'
                        return 'left'
                      }

                      const isSortable = column.id !== 'checkbox'
                      const isSorted = sortConfig.column === column.id
                      const isDragging = draggedColumn === column.id

                      return (
                        <th
                          key={column.id}
                          draggable={column.id !== 'checkbox'}
                          onDragStart={() => handleDragStart(column.id)}
                          onDragOver={(e) => handleDragOver(e, column.id)}
                          onDrop={(e) => handleDrop(e, column.id)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            // Resize handle-a kliklədikdə sort işləməsin
                            if ((e.target as HTMLElement).closest('[data-resize-handle]')) return
                            if (isSortable) handleSort(column.id)
                          }}
                          style={{
                            padding: '0.75rem',
                            textAlign: getAlign(),
                            borderRight: '1px solid #dee2e6',
                            width: column.width,
                            minWidth: column.width,
                            cursor: isSortable ? 'pointer' : 'default',
                            userSelect: 'none',
                            background: isSorted ? '#e3f2fd' : isDragging ? '#e0e0e0' : undefined,
                            position: 'relative',
                            opacity: isDragging ? 0.5 : 1
                          }}
                          title={isSortable ? 'Sıralamaq üçün klikləyin, sürüşdürmək üçün drag edin' : ''}
                        >
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem', 
                            justifyContent: getAlign() === 'right' ? 'flex-end' : 'flex-start',
                            position: 'relative'
                          }}>
                            <span>{column.label}</span>
                            {isSortable && (
                              <span style={{ 
                                fontSize: '0.8rem', 
                                color: isSorted ? '#1976d2' : '#999',
                                fontWeight: isSorted ? 'bold' : 'normal'
                              }}>
                                {isSorted ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '⇅'}
                              </span>
                            )}
                          </div>
                          {/* Resize handle */}
                          {column.id !== 'checkbox' && (
                            <div
                              data-resize-handle
                              onMouseDown={(e) => {
                                e.stopPropagation()
                                handleResizeStart(e, column.id)
                              }}
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: 0,
                                bottom: 0,
                                width: '5px',
                                cursor: 'col-resize',
                                background: resizingColumn === column.id ? '#007bff' : 'transparent',
                                zIndex: 10,
                                transition: resizingColumn === column.id ? 'none' : 'background 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                if (resizingColumn !== column.id) {
                                  (e.currentTarget as HTMLElement).style.background = '#ccc'
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (resizingColumn !== column.id) {
                                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                                }
                              }}
                              title="Genişliyi dəyişdirmək üçün sürüşdürün"
                            />
                          )}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={sortedColumns.filter(col => col.visible).length} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                        Məhsul tapılmadı
                      </td>
                    </tr>
                  ) : (
                    sortedProducts.map((product) => {
                      const quantity = getWarehouseQuantity(product)
                      const quantityNum = parseFloat(quantity.toString())
                      const isLowStock = quantityNum < 10
                      const isOutOfStock = quantityNum === 0
                      
                      return (
                        <tr
                          key={product.id}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('productId', product.id.toString())
                          }}
                          onClick={(e) => handleSelectRow(product.id, e)}
                          style={{
                            borderBottom: '1px solid #dee2e6',
                            background: selectedRows.includes(product.id) ? '#e7f3ff' : 'white',
                            ...(isOutOfStock && { background: selectedRows.includes(product.id) ? '#ffe7e7' : '#fff5f5' }),
                            cursor: 'pointer'
                          }}
                        >
                          {sortedColumns.map((column) => {
                            if (!column.visible && column.id !== 'checkbox') return null

                            if (column.id === 'checkbox') {
                              return (
                                <td
                                  key={column.id}
                                  style={{
                                    padding: '0.75rem',
                                    borderRight: '1px solid #dee2e6',
                                    width: column.width
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedRows.includes(product.id)}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      handleSelectRow(product.id, e.nativeEvent as any)
                                    }}
                                  />
                                </td>
                              )
                            }

                            const getAlign = () => {
                              if (column.id.includes('price') || column.id === 'quantity' || column.id === 'purchase_total' || column.id === 'sale_total') return 'right'
                              return 'left'
                            }

                            const getCellContent = () => {
                              switch (column.id) {
                                case 'id':
                                  return product.id
                                case 'name':
                                  return <span style={{ fontWeight: '500' }}>{product.name}</span>
                                case 'code':
                                  return product.code || '-'
                                case 'barcode':
                                  return product.barcode || '-'
                                case 'unit':
                                  return product.unit || 'ədəd'
                                case 'purchase_price':
                                  return `${product.purchase_price || 0} AZN`
                                case 'sale_price':
                                  return <span style={{ fontWeight: 'bold' }}>{product.sale_price || 0} AZN</span>
                                case 'quantity':
                                  return (
                                    <span style={{
                                      fontWeight: 'bold',
                                      color: isOutOfStock ? '#dc3545' : isLowStock ? '#ffc107' : '#28a745'
                                    }}>
                                      {quantity} {product.unit || 'ədəd'}
                                    </span>
                                  )
                                case 'purchase_total':
                                  const purchasePrice = parseFloat(product.purchase_price?.toString() || '0')
                                  const purchaseQty = quantityNum
                                  const purchaseTotal = purchasePrice * purchaseQty
                                  return (
                                    <span style={{ fontWeight: 'bold', color: '#28a745' }}>
                                      {purchaseTotal.toFixed(2)} AZN
                                    </span>
                                  )
                                case 'sale_total':
                                  const salePrice = parseFloat(product.sale_price?.toString() || '0')
                                  const saleQty = quantityNum
                                  const saleTotal = salePrice * saleQty
                                  return (
                                    <span style={{ fontWeight: 'bold', color: '#007bff' }}>
                                      {saleTotal.toFixed(2)} AZN
                                    </span>
                                  )
                                default:
                                  return '-'
                              }
                            }

                            return (
                              <td
                                key={column.id}
                                style={{
                                  padding: '0.75rem',
                                  borderRight: '1px solid #dee2e6',
                                  textAlign: getAlign(),
                                  width: column.width
                                }}
                              >
                                {getCellContent()}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  )}
                </tbody>
                {/* Total sətir */}
                {sortedProducts.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8f9fa', borderTop: '2px solid #dee2e6', fontWeight: 'bold' }}>
                      {sortedColumns.map((column) => {
                        if (!column.visible && column.id !== 'checkbox') return null

                        if (column.id === 'checkbox') {
                          return (
                            <td
                              key={column.id}
                              style={{
                                padding: '0.75rem',
                                borderRight: '1px solid #dee2e6',
                                width: column.width
                              }}
                            >
                            </td>
                          )
                        }

                        const getAlign = () => {
                          if (column.id.includes('price') || column.id === 'quantity' || column.id === 'purchase_total' || column.id === 'sale_total') return 'right'
                          return 'left'
                        }

                        const getTotalContent = () => {
                          switch (column.id) {
                            case 'purchase_price':
                              // Alış qiyməti sütununun altında: sadəcə alış qiymətlərinin cəmi (qalıqla vurulmur)
                              const totalPurchasePrice = sortedProducts.reduce((sum, p) => {
                                const price = parseFloat(p.purchase_price?.toString() || '0')
                                return sum + price
                              }, 0)
                              return <span style={{ color: '#007bff', fontWeight: 'bold' }}>{totalPurchasePrice.toFixed(2)} AZN</span>
                            
                            case 'sale_price':
                              // Satış qiyməti sütununun altında: sadəcə satış qiymətlərinin cəmi (qalıqla vurulmur)
                              const totalSalePrice = sortedProducts.reduce((sum, p) => {
                                const price = parseFloat(p.sale_price?.toString() || '0')
                                return sum + price
                              }, 0)
                              return <span style={{ color: '#007bff', fontWeight: 'bold' }}>{totalSalePrice.toFixed(2)} AZN</span>
                            
                            case 'quantity':
                              // Qalıq sütununun altında: qalıqların cəmi
                              const totalQty = sortedProducts.reduce((sum, p) => {
                                const qty = parseFloat(getWarehouseQuantity(p).toString())
                                return sum + qty
                              }, 0)
                              return <span style={{ color: '#28a745', fontWeight: 'bold' }}>{totalQty.toFixed(2)}</span>
                            
                            case 'purchase_total':
                              // Alış cəm sütununun altında: alış qiyməti × qalıq cəmi
                              const totalPurchaseSum = sortedProducts.reduce((sum, p) => {
                                const qty = parseFloat(getWarehouseQuantity(p).toString())
                                const price = parseFloat(p.purchase_price?.toString() || '0')
                                return sum + (price * qty)
                              }, 0)
                              return <span style={{ color: '#28a745', fontWeight: 'bold', fontSize: '1.1rem' }}>{totalPurchaseSum.toFixed(2)} AZN</span>
                            
                            case 'sale_total':
                              // Satış cəm sütununun altında: satış qiyməti × qalıq cəmi
                              const totalSaleSum = sortedProducts.reduce((sum, p) => {
                                const qty = parseFloat(getWarehouseQuantity(p).toString())
                                const salePrice = parseFloat(p.sale_price?.toString() || '0')
                                return sum + (salePrice * qty)
                              }, 0)
                              return <span style={{ color: '#007bff', fontWeight: 'bold', fontSize: '1.1rem' }}>{totalSaleSum.toFixed(2)} AZN</span>
                            
                            default:
                              return column.id === 'name' ? 'Cəmi:' : ''
                          }
                        }

                        return (
                          <td
                            key={column.id}
                            style={{
                              padding: '0.75rem',
                              borderRight: '1px solid #dee2e6',
                              textAlign: getAlign(),
                              width: column.width
                            }}
                          >
                            {getTotalContent()}
                          </td>
                        )
                      })}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* Seçilmiş məhsullar sayı */}
          {selectedRows.length > 0 && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: '#e7f3ff',
              borderRadius: '4px',
              color: '#004085'
            }}>
              {selectedRows.length} məhsul seçilib
            </div>
          )}

          {/* Kontekst Menyu */}
          {contextMenu.visible && (
            <div
              style={{
                position: 'fixed',
                top: contextMenu.y,
                left: contextMenu.x,
                background: 'white',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                zIndex: 2000,
                minWidth: '200px',
                padding: '0.25rem 0'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {contextMenu.type === 'table' && (
                <>
                  <div
                    onClick={() => {
                      setShowSettings(true)
                      setContextMenu({ ...contextMenu, visible: false })
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    ⚙️ Ayarlar
                  </div>
                  <div
                    onClick={() => {
                      if (selectedRows.length === 1) {
                        handleEdit()
                        setContextMenu({ ...contextMenu, visible: false })
                      }
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: selectedRows.length === 1 ? 'pointer' : 'not-allowed',
                      opacity: selectedRows.length === 1 ? 1 : 0.5,
                      borderBottom: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedRows.length === 1) {
                        e.currentTarget.style.background = '#f0f0f0'
                      }
                    }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    ✏️ Redaktə
                  </div>
                  <div
                    onClick={() => {
                      if (selectedRows.length > 0) {
                        handleDelete()
                        setContextMenu({ ...contextMenu, visible: false })
                      }
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: selectedRows.length > 0 ? 'pointer' : 'not-allowed',
                      opacity: selectedRows.length > 0 ? 1 : 0.5,
                      borderBottom: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedRows.length > 0) {
                        e.currentTarget.style.background = '#f0f0f0'
                      }
                    }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    🗑️ Sil
                  </div>
                  <div
                    onClick={() => {
                      if (selectedRows.length > 0) {
                        handleCopy()
                        setContextMenu({ ...contextMenu, visible: false })
                      }
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: selectedRows.length > 0 ? 'pointer' : 'not-allowed',
                      opacity: selectedRows.length > 0 ? 1 : 0.5,
                      borderBottom: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedRows.length > 0) {
                        e.currentTarget.style.background = '#f0f0f0'
                      }
                    }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    📋 Kopyala
                  </div>
                  <div
                    onClick={() => {
                      const searchInput = document.querySelector('input[placeholder*="Axtarış"]') as HTMLInputElement
                      if (searchInput) {
                        searchInput.focus()
                      }
                      setContextMenu({ ...contextMenu, visible: false })
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    🔍 Axtarış
                  </div>
                  <div
                    onClick={() => {
                      const filterSelect = document.querySelector('select') as HTMLSelectElement
                      if (filterSelect) {
                        filterSelect.focus()
                      }
                      setContextMenu({ ...contextMenu, visible: false })
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    🔽 Filtr
                  </div>
                  <div
                    onClick={() => {
                      handlePrint()
                      setContextMenu({ ...contextMenu, visible: false })
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    🖨️ Çap
                  </div>
                </>
              )}
              {contextMenu.type === 'category' && contextMenu.categoryId !== null && contextMenu.categoryId !== undefined && (
                <>
                  <div
                    onClick={() => {
                      const category = categories.find(c => c.id === contextMenu.categoryId)
                      if (category) {
                        handleCreateSubCategory(category)
                      }
                      setContextMenu({ ...contextMenu, visible: false })
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    ➕ Alt papka yarat
                  </div>
                  <div
                    onClick={() => {
                      const category = categories.find(c => c.id === contextMenu.categoryId)
                      if (category) {
                        handleEditCategory(category)
                      }
                      setContextMenu({ ...contextMenu, visible: false })
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    ✏️ Redaktə
                  </div>
                  <div
                    onClick={() => {
                      const category = categories.find(c => c.id === contextMenu.categoryId)
                      if (category) {
                        handleMoveCategory(category)
                      }
                      setContextMenu({ ...contextMenu, visible: false })
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #eee'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    📦 Köçür
                  </div>
                  <div
                    onClick={() => {
                      const category = categories.find(c => c.id === contextMenu.categoryId)
                      if (category) {
                        handleDeleteCategory(category)
                      }
                      setContextMenu({ ...contextMenu, visible: false })
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                  >
                    🗑️ Sil
                  </div>
                </>
              )}
            </div>
          )}

          {/* Ayarlar Modal */}
          {showSettings && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000
              }}
              onClick={() => setShowSettings(false)}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '2rem',
                  maxWidth: '600px',
                  width: '90%',
                  maxHeight: '80vh',
                  overflow: 'auto',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0 }}>Cədvəl Ayarları</h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                      color: '#666'
                    }}
                  >
                    ×
                  </button>
                </div>

                {/* Tab Navigation */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #dee2e6' }}>
                  <button
                    onClick={() => setSettingsTab('columns')}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: settingsTab === 'columns' ? '#007bff' : 'transparent',
                      color: settingsTab === 'columns' ? 'white' : '#666',
                      border: 'none',
                      borderBottom: settingsTab === 'columns' ? '3px solid #0056b3' : '3px solid transparent',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: settingsTab === 'columns' ? 'bold' : 'normal'
                    }}
                  >
                    Sütunlar
                  </button>
                  <button
                    onClick={() => setSettingsTab('functions')}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: settingsTab === 'functions' ? '#007bff' : 'transparent',
                      color: settingsTab === 'functions' ? 'white' : '#666',
                      border: 'none',
                      borderBottom: settingsTab === 'functions' ? '3px solid #0056b3' : '3px solid transparent',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: settingsTab === 'functions' ? 'bold' : 'normal'
                    }}
                  >
                    Funksiyalar
                  </button>
                </div>

                {/* Sütunlar Tab */}
                {settingsTab === 'columns' && (
                  <>
                    <div style={{ marginBottom: '1rem' }}>
                      <button
                        onClick={resetColumns}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.9rem'
                        }}
                      >
                        🔄 Varsayılanlara qaytar
                      </button>
                    </div>

                    <div style={{ border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Sütun</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Göstər</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Genişlik</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Yer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedColumns.filter(col => col.id !== 'checkbox').map((column, index) => (
                        <tr key={column.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                          <td style={{ padding: '0.75rem', fontWeight: '500' }}>{column.label}</td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={column.visible}
                              onChange={() => toggleColumnVisibility(column.id)}
                            />
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <input
                              type="number"
                              value={column.width}
                              onChange={(e) => updateColumnWidth(column.id, parseInt(e.target.value) || 50)}
                              min={50}
                              max={500}
                              style={{
                                width: '80px',
                                padding: '0.25rem',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                textAlign: 'center'
                              }}
                            />
                            <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.9rem' }}>px</span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                            <button
                              onClick={() => moveColumn(column.id, 'up')}
                              disabled={index === 0}
                              style={{
                                background: index === 0 ? '#ccc' : '#007bff',
                                color: 'white',
                                border: 'none',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                cursor: index === 0 ? 'not-allowed' : 'pointer',
                                marginRight: '0.25rem',
                                fontSize: '0.85rem'
                              }}
                              title="Yuxarı"
                            >
                              ↑
                            </button>
                            <button
                              onClick={() => moveColumn(column.id, 'down')}
                              disabled={index === sortedColumns.filter(col => col.id !== 'checkbox').length - 1}
                              style={{
                                background: index === sortedColumns.filter(col => col.id !== 'checkbox').length - 1 ? '#ccc' : '#007bff',
                                color: 'white',
                                border: 'none',
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                cursor: index === sortedColumns.filter(col => col.id !== 'checkbox').length - 1 ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem'
                              }}
                              title="Aşağı"
                            >
                              ↓
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                  </>
                )}

                {/* Funksiyalar Tab */}
                {settingsTab === 'functions' && (
                  <div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ marginBottom: '1rem', color: '#333' }}>Seçim Funksiyaları</h3>
                      
                      <div style={{ 
                        padding: '1rem', 
                        background: '#f8f9fa', 
                        borderRadius: '8px',
                        marginBottom: '1rem'
                      }}>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem',
                          cursor: 'pointer',
                          marginBottom: '1rem'
                        }}>
                          <input
                            type="checkbox"
                            checked={functionSettings.multiSelect}
                            onChange={(e) => updateFunctionSettings('multiSelect', e.target.checked)}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                              Çoxlu seçim aktivdir
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#666' }}>
                              Birdən çox məhsul seçməyə imkan verir
                            </div>
                          </div>
                        </label>

                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem',
                          cursor: 'pointer',
                          marginBottom: '1rem'
                        }}>
                          <input
                            type="checkbox"
                            checked={functionSettings.ctrlClickMultiSelect}
                            onChange={(e) => updateFunctionSettings('ctrlClickMultiSelect', e.target.checked)}
                            disabled={!functionSettings.multiSelect}
                            style={{ 
                              width: '20px', 
                              height: '20px', 
                              cursor: functionSettings.multiSelect ? 'pointer' : 'not-allowed',
                              opacity: functionSettings.multiSelect ? 1 : 0.5
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                              Ctrl basaraq çoxlu seçim
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#666' }}>
                              Aktivdirsə, yalnız Ctrl basaraq birdən çox məhsul seçilə bilər. Passivdirsə, normal kliklə çoxlu seçim mümkündür.
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.25rem' }}>
                              Ctrl+A ilə hamısını seçmək həmişə mümkündür
                            </div>
                          </div>
                        </label>
                      </div>

                      <div style={{ 
                        padding: '1rem', 
                        background: '#f8f9fa', 
                        borderRadius: '8px'
                      }}>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem',
                          cursor: 'pointer'
                        }}>
                          <input
                            type="checkbox"
                            checked={functionSettings.deleteEnabled}
                            onChange={(e) => updateFunctionSettings('deleteEnabled', e.target.checked)}
                            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                              Delete düyməsi ilə silmə
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#666' }}>
                              Aktivdirsə, Delete düyməsinə basaraq seçilmiş məhsulları silmək mümkündür
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    onClick={() => setShowSettings(false)}
                    style={{
                      padding: '0.5rem 1.5rem',
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}
                  >
                    Bağla
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Məhsul Əlavə/Redaktə Modal */}
          {showProductModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1001
              }}
              onClick={() => setShowProductModal(false)}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '2rem',
                  maxWidth: '600px',
                  width: '90%',
                  maxHeight: '90vh',
                  overflow: 'auto',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0 }}>
                    {editingProduct ? 'Məhsul Redaktə Et' : 'Yeni Məhsul Əlavə Et'}
                  </h2>
                  <button
                    onClick={() => setShowProductModal(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                      color: '#666'
                    }}
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleProductSubmit}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      Məhsul adı <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={productFormData.name}
                      onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '1rem'
                      }}
                      placeholder="Məhsul adını daxil edin"
                    />
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      Artikul
                    </label>
                    <input
                      type="text"
                      value={productFormData.article}
                      onChange={(e) => setProductFormData({ ...productFormData, article: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '1rem'
                      }}
                      placeholder="Artikul"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Kod
                      </label>
                      <input
                        type="text"
                        value={productFormData.code}
                        onChange={(e) => setProductFormData({ ...productFormData, code: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '1rem',
                          background: productFormData.barcode && !productFormData.code ? '#f0f0f0' : 'white'
                        }}
                        placeholder="Avtomatik (barkodun son 6 rəqəmi)"
                        readOnly={!!productFormData.barcode && !productFormData.code}
                        title={productFormData.barcode && !productFormData.code ? 'Barkodun son 6 rəqəmi avtomatik təyin olunur' : ''}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Barkod
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          value={productFormData.barcode}
                          onChange={(e) => handleBarcodeChange(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '1rem'
                          }}
                          placeholder="Barkod"
                        />
                        <button
                          type="button"
                          onClick={() => setShowBarcodeScanner(true)}
                          style={{
                            padding: '0.75rem',
                            background: '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1.2rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '45px'
                          }}
                          title="Barkod oxu"
                        >
                          📷
                        </button>
                        <button
                          type="button"
                          onClick={handleAutoGenerateBarcode}
                          style={{
                            padding: '0.75rem',
                            background: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap'
                          }}
                          title="Avtomatik barkod yarat"
                        >
                          🔄
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      Təsvir
                    </label>
                    <textarea
                      value={productFormData.description}
                      onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '1rem',
                        resize: 'vertical'
                      }}
                      placeholder="Məhsul təsviri"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Vahid
                      </label>
                      <select
                        value={productFormData.unit}
                        onChange={(e) => setProductFormData({ ...productFormData, unit: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '1rem'
                        }}
                      >
                        <option value="ədəd">ədəd</option>
                        <option value="kq">kq</option>
                        <option value="litr">litr</option>
                        <option value="metr">metr</option>
                        <option value="dəst">dəst</option>
                        <option value="qutu">qutu</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Alış qiyməti (AZN)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={productFormData.purchase_price}
                        onChange={(e) => setProductFormData({ ...productFormData, purchase_price: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '1rem'
                        }}
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Satış qiyməti (AZN) <span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={productFormData.sale_price}
                        onChange={(e) => setProductFormData({ ...productFormData, sale_price: e.target.value })}
                        required
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '1rem'
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  {/* Əlavə Məlumatlar */}
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '2px solid #eee' }}>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', color: '#333' }}>Əlavə Məlumatlar</h3>
                    
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Papka
                      </label>
                      <select
                        value={productFormData.category_id}
                        onChange={(e) => setProductFormData({ ...productFormData, category_id: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          fontSize: '1rem'
                        }}
                      >
                        <option value="">Papka seçin</option>
                        {(() => {
                          const renderCategoryOptions = (categories: Category[], prefix = '') => {
                            return categories.map(cat => (
                              <React.Fragment key={cat.id}>
                                <option value={cat.id.toString()}>
                                  {prefix}{cat.name}
                                </option>
                                {cat.children && cat.children.length > 0 && 
                                  renderCategoryOptions(cat.children, prefix + '  ')
                                }
                              </React.Fragment>
                            ))
                          }
                          return renderCategoryOptions(categoryTree)
                        })()}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Növ/Tip
                        </label>
                        <input
                          type="text"
                          value={productFormData.type}
                          onChange={(e) => setProductFormData({ ...productFormData, type: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '1rem'
                          }}
                          placeholder="Növ/Tip"
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Marka
                        </label>
                        <input
                          type="text"
                          value={productFormData.brand}
                          onChange={(e) => setProductFormData({ ...productFormData, brand: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '1rem'
                          }}
                          placeholder="Marka"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Model
                        </label>
                        <input
                          type="text"
                          value={productFormData.model}
                          onChange={(e) => setProductFormData({ ...productFormData, model: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '1rem'
                          }}
                          placeholder="Model"
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Rəng
                        </label>
                        <input
                          type="text"
                          value={productFormData.color}
                          onChange={(e) => setProductFormData({ ...productFormData, color: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '1rem'
                          }}
                          placeholder="Rəng"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Ölkə
                        </label>
                        <input
                          type="text"
                          value={productFormData.country}
                          onChange={(e) => setProductFormData({ ...productFormData, country: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '1rem'
                          }}
                          placeholder="Ölkə"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          İstehsalçı
                        </label>
                        <input
                          type="text"
                          value={productFormData.manufacturer}
                          onChange={(e) => setProductFormData({ ...productFormData, manufacturer: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '1rem'
                          }}
                          placeholder="İstehsalçı"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          İstehsal tarixi
                        </label>
                        <input
                          type="date"
                          value={productFormData.production_date}
                          onChange={(e) => setProductFormData({ ...productFormData, production_date: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '1rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Bitmə tarixi
                        </label>
                        <input
                          type="date"
                          value={productFormData.expiry_date}
                          onChange={(e) => setProductFormData({ ...productFormData, expiry_date: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '1rem'
                          }}
                        />
                      </div>
                    </div>

                    {/* Zəmanət müddəti (avtomatik hesablanır) */}
                    {productFormData.production_date && productFormData.expiry_date && (
                      <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '4px', border: '1px solid #dee2e6' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#495057' }}>
                          Zəmanət müddəti (avtomatik hesablanır)
                        </label>
                        <div style={{ fontSize: '1rem', color: '#007bff', fontWeight: 'bold' }}>
                          {(() => {
                            try {
                              const productionDate = new Date(productFormData.production_date + 'T00:00:00')
                              const expiryDate = new Date(productFormData.expiry_date + 'T00:00:00')
                              
                              if (isNaN(productionDate.getTime()) || isNaN(expiryDate.getTime())) {
                                return <span style={{ color: '#dc3545' }}>Tarixlər düzgün deyil</span>
                              }
                              
                              if (expiryDate.getTime() < productionDate.getTime()) {
                                return <span style={{ color: '#dc3545' }}>Bitmə tarixi istehsal tarixindən əvvəl ola bilməz</span>
                              }
                              
                              return formatDateDifference(productionDate, expiryDate)
                            } catch (e) {
                              return <span style={{ color: '#dc3545' }}>Hesablama xətası</span>
                            }
                          })()}
                        </div>
                        
                        {/* Zəmanət qalıb */}
                        {(() => {
                          try {
                            const expiryDate = new Date(productFormData.expiry_date + 'T00:00:00')
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            
                            if (isNaN(expiryDate.getTime())) {
                              return null
                            }
                            
                            if (expiryDate.getTime() < today.getTime()) {
                              return (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#dc3545', fontWeight: 'bold' }}>
                                  Zəmanət bitib
                                </div>
                              )
                            }
                            
                            const remaining = formatDateDifference(today, expiryDate)
                            
                            if (remaining === '0 gün') {
                              return (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#dc3545', fontWeight: 'bold' }}>
                                  Zəmanət bitib
                                </div>
                              )
                            }
                            
                            return (
                              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#28a745', fontWeight: 'bold' }}>
                                {remaining + ' qalıb'}
                              </div>
                            )
                          } catch (e) {
                            return null
                          }
                        })()}
                      </div>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={productFormData.is_active}
                          onChange={(e) => setProductFormData({ ...productFormData, is_active: e.target.checked })}
                          style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        />
                        <span style={{ fontWeight: '500' }}>Aktivdir</span>
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
                    <button
                      type="button"
                      onClick={() => setShowProductModal(false)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '1rem'
                      }}
                    >
                      Ləğv et
                    </button>
                    <button
                      type="submit"
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: editingProduct ? '#007bff' : '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: 'bold'
                      }}
                    >
                      {editingProduct ? 'Yadda saxla' : 'Əlavə et'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Barkod Oxuyucu Modal */}
          {showBarcodeScanner && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1002
              }}
              onClick={() => {
                setShowBarcodeScanner(false)
                setBarcodeScanMethod(null)
              }}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '2rem',
                  maxWidth: '400px',
                  width: '90%',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {!barcodeScanMethod ? (
                  <>
                    <h3 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Barkod Oxuma Metodu</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <button
                        onClick={() => {
                          setBarcodeScanMethod('camera')
                          handleBarcodeScanFromCamera()
                        }}
                        style={{
                          padding: '1rem',
                          background: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        📷 Kameradan oxu
                      </button>
                      <button
                        onClick={() => {
                          setBarcodeScanMethod('gallery')
                          handleBarcodeScanFromGallery()
                        }}
                        style={{
                          padding: '1rem',
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        🖼️ Qalereyadan seç
                      </button>
                      <button
                        onClick={() => {
                          setShowBarcodeScanner(false)
                          setBarcodeScanMethod(null)
                        }}
                        style={{
                          padding: '1rem',
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '1rem'
                        }}
                      >
                        Ləğv et
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ marginBottom: '1rem' }}>
                      {barcodeScanMethod === 'camera' 
                        ? 'Kamera açılır... Barkod oxuyucu kitabxanası quraşdırılmalıdır.'
                        : 'Şəkil seçin... Barkod oxuyucu kitabxanası quraşdırılmalıdır.'}
                    </p>
                    <button
                      onClick={() => {
                        setShowBarcodeScanner(false)
                        setBarcodeScanMethod(null)
                      }}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '1rem'
                      }}
                    >
                      Bağla
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

