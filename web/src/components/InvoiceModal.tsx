import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWindowStore } from '../store/windowStore'
import type { Customer, Product, Supplier } from '@shared/types'
import TableSettingsModal, { type ColumnConfig as TableColumnConfig, type FunctionSettings } from './TableSettingsModal'

const COLUMN_DRAG_STORAGE_KEY = 'invoice-modal-column-drag-enabled'
const TABLE_COLUMNS_STORAGE_KEY = 'invoice-modal-table-columns'

const BASE_TABLE_COLUMNS: TableColumnConfig[] = [
  { id: 'checkbox', label: 'Seçim', visible: true, width: 40, order: 0 },
  { id: 'number', label: '№', visible: true, width: 50, order: 1 },
  { id: 'product', label: 'Məhsul', visible: true, width: 200, order: 2 },
  { id: 'code', label: 'Kod', visible: true, width: 120, order: 3 },
  { id: 'barcode', label: 'Barkod', visible: true, width: 120, order: 4 },
  { id: 'unit', label: 'Vahid', visible: true, width: 80, order: 5 },
  { id: 'quantity', label: 'Miqdar', visible: true, width: 100, order: 6 },
  { id: 'unitPrice', label: 'Vahid qiymət', visible: true, width: 120, order: 7 },
  { id: 'total', label: 'Cəm', visible: true, width: 120, order: 8 },
]

const normalizeColumns = (source?: Partial<TableColumnConfig>[]): TableColumnConfig[] => {
  if (!source || !Array.isArray(source)) {
    return BASE_TABLE_COLUMNS.map((col) => ({ ...col }))
  }

  const sourceMap = new Map(source.map((col) => [col?.id, col]))

  return BASE_TABLE_COLUMNS.map((baseCol) => {
    const stored = sourceMap.get(baseCol.id)
    return {
      ...baseCol,
      visible: typeof stored?.visible === 'boolean' ? stored.visible : baseCol.visible,
      width: typeof stored?.width === 'number' ? stored.width : baseCol.width,
      order: typeof stored?.order === 'number' ? stored.order : baseCol.order,
    }
  })
}

export interface InvoiceItem {
  product_id: number | null
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  searchTerm?: string // Məhsul axtarışı üçün
}

export interface ModalData {
  id: string
  invoiceId: number | null
  position: { x: number, y: number }
  size: { width: number, height: number }
  isMaximized: boolean
  zIndex: number
  isActive?: boolean // Qaimənin təsdiq statusu (mövcud qaimələr üçün)
  data: {
    selectedCustomerId?: number | null
    selectedCustomer?: Customer | null
    selectedSupplierId?: number | null
    selectedSupplier?: Supplier | null
    invoiceItems: InvoiceItem[]
    notes: string
    paymentDate?: string
    invoiceNumber?: string
    invoiceDate?: string
  }
  invoiceType?: 'sale' | 'purchase' // Satış və ya alış qaiməsi
}

interface InvoiceModalProps {
  modal: ModalData
  customers?: Customer[]
  suppliers?: Supplier[]
  products: Product[]
  modalIndex: number
  isActive: boolean
  onClose: (modalId: string) => void
  onUpdate: (modalId: string, updates: Partial<ModalData>) => void
  onSave: (modalId: string, modalData: ModalData['data']) => Promise<void>
  onSaveAndConfirm?: (modalId: string, modalData: ModalData['data']) => Promise<void> // OK düyməsi üçün - yadda saxla və təsdiqlə
  onActivate: (modalId: string) => void
  windowId: string
  onPrint?: (modalId: string, modalData: ModalData['data']) => void // Çap funksiyası
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ 
  modal, 
  customers = [], 
  suppliers = [],
  products, 
  modalIndex, 
  isActive, 
  onClose, 
  onUpdate, 
  onSave, 
  onSaveAndConfirm,
  onActivate, 
  windowId,
  onPrint
}) => {
  const navigate = useNavigate()
  const invoiceType = modal.invoiceType || 'sale' // Default satış
  const isPurchase = invoiceType === 'purchase'
  
  const [localData, setLocalData] = useState(modal.data)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 })
  const [resizeStartSize, setResizeStartSize] = useState({ width: 0, height: 0 })
  const [localSize, setLocalSize] = useState<{ width: number, height: number } | null>(null)
  
  // Window store
  const { windows, minimizeWindow, restoreWindow, updateWindow } = useWindowStore()
  const windowInfo = windows.get(windowId)
  const isMinimized = windowInfo?.isMinimized || false
  const isVisible = windowInfo?.isVisible !== false
  
  // Window store'dan position və size al (tile windows üçün)
  const effectivePosition = React.useMemo(() => windowInfo?.position || modal.position, [windowInfo?.position, modal.position])
  // Resize sırasında local size kullan, yoksa window store veya modal size
  const effectiveSize = React.useMemo(() => {
    if (localSize) return localSize
    return windowInfo?.size || modal.size
  }, [localSize, windowInfo?.size, modal.size])
  
  // Form state-ləri
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('')
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [notesFocused, setNotesFocused] = useState(false)
  const [selectedItemIndices, setSelectedItemIndices] = useState<number[]>([])
  const [showItemSettingsModal, setShowItemSettingsModal] = useState(false)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [enableColumnDrag, setEnableColumnDrag] = useState(false)
  const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null)
  
  const [tableColumns, setTableColumns] = useState<TableColumnConfig[]>(() => {
    if (typeof window === 'undefined') {
      return normalizeColumns()
    }
    try {
      const stored = window.localStorage.getItem(TABLE_COLUMNS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return normalizeColumns(parsed)
      }
    } catch {
      // ignore parse errors
    }
    return normalizeColumns()
  })
  
  // Köhnə format üçün helper funksiyalar (backward compatibility)
  const visibleOrderedColumns = useMemo(() => {
    return [...tableColumns]
      .filter(column => column.visible)
      .sort((a, b) => a.order - b.order)
  }, [tableColumns])

  const visibleColumnCount = visibleOrderedColumns.length

  const columnConfig = useMemo(() => {
    const config: { [key: string]: { width: number; order: number } } = {}
    tableColumns.forEach(col => {
      config[col.id] = { width: col.width, order: col.order }
    })
    return config
  }, [tableColumns])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedValue = window.localStorage.getItem(COLUMN_DRAG_STORAGE_KEY)
        if (storedValue !== null) {
          setEnableColumnDrag(storedValue === 'true')
        }
      }
    } catch {
      // ignore storage read errors
    }
  }, [])

  const updateEnableColumnDrag = React.useCallback((value: boolean) => {
    setEnableColumnDrag(value)
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(COLUMN_DRAG_STORAGE_KEY, value ? 'true' : 'false')
      }
    } catch {
      // ignore storage write errors
    }
  }, [])

  const functionSettings: FunctionSettings = useMemo(() => ({
    enableColumnDrag
  }), [enableColumnDrag])

  const functionTabContent = useMemo(() => (
    <div>
      <div
        style={{
          padding: '1rem',
          background: '#f8f9fa',
          borderRadius: '8px',
          marginBottom: '1rem',
          border: '1px solid #e9ecef'
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem' }}>
          Sütun Funksiyaları
        </h3>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            cursor: 'pointer'
          }}
        >
          <input
            type="checkbox"
            checked={enableColumnDrag}
            onChange={(e) => updateEnableColumnDrag(e.target.checked)}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
          <div>
            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
              Sütun sürüşdürmə
            </div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>
              Aktiv olduqda cədvəl başlıqlarını mouse ilə sürüşdürərək yerini
              dəyişə bilərsən.
            </div>
          </div>
        </label>
      </div>
      <p style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}>
        * Sütunu daşımaq üçün başlığı basılı saxlayıb yeni mövqeyə sürüşdür.
      </p>
    </div>
  ), [enableColumnDrag, updateEnableColumnDrag])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(TABLE_COLUMNS_STORAGE_KEY, JSON.stringify(tableColumns))
      }
    } catch {
      // ignore storage write errors
    }
  }, [tableColumns])
  
  // Filtered lists
  const filteredCustomers = React.useMemo(() => {
    if (!customerSearchTerm.trim()) return []
    const term = customerSearchTerm.toLowerCase()
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(term) ||
      customer.phone?.toLowerCase().includes(term) ||
      customer.email?.toLowerCase().includes(term)
    ).slice(0, 10)
  }, [customers, customerSearchTerm])
  
  const filteredSuppliers = React.useMemo(() => {
    if (!supplierSearchTerm.trim()) return []
    const term = supplierSearchTerm.toLowerCase()
    return suppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(term) ||
      supplier.phone?.toLowerCase().includes(term) ||
      supplier.email?.toLowerCase().includes(term)
    ).slice(0, 10)
  }, [suppliers, supplierSearchTerm])
  
  // Date formatting function
  const formatDateInput = (input: string): string => {
    const trimmed = input.trim()
    if (!trimmed) return ''
    
    // Əgər tam tarix formatındadırsa (YYYY-MM-DD), qaytar
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed
    }
    
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    
    // Sadə formatlar: "15", "15.11", "15.11.2025"
    const parts = trimmed.split(/[.\-\/]/)
    
    if (parts.length === 1) {
      // Yalnız gün: "15" -> "2025-01-15" (cari ay və il)
      const day = parseInt(parts[0])
      if (day >= 1 && day <= 31) {
        return `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
    } else if (parts.length === 2) {
      // Gün və ay: "15.11" -> "2025-11-15" (cari il)
      const day = parseInt(parts[0])
      const month = parseInt(parts[1])
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
    } else if (parts.length === 3) {
      // Tam tarix: "15.11.2025" -> "2025-11-15"
      const day = parseInt(parts[0])
      const month = parseInt(parts[1])
      const year = parseInt(parts[2])
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
    }
    
    return trimmed // Əgər format düzgün deyilsə, olduğu kimi qaytar
  }
  
  // Helper functions
  const handleAddEmptyRow = () => {
    const newItems = [...localData.invoiceItems, {
      product_id: null,
      product_name: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
    }]
    setLocalData({ ...localData, invoiceItems: newItems })
  }
  
  const handleUpdateItem = (index: number, field: 'quantity' | 'unit_price', value: number) => {
    const updatedItems = [...localData.invoiceItems]
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
      total_price: field === 'quantity' 
        ? value * updatedItems[index].unit_price
        : updatedItems[index].quantity * value
    }
    setLocalData({ ...localData, invoiceItems: updatedItems })
  }
  
  const handleRemoveItem = (index: number) => {
    const newItems = localData.invoiceItems.filter((_, i) => i !== index)
    setLocalData({ ...localData, invoiceItems: newItems })
  }
  
  const handleToggleItemSelection = (index: number) => {
    if (selectedItemIndices.includes(index)) {
      setSelectedItemIndices(selectedItemIndices.filter(i => i !== index))
    } else {
      setSelectedItemIndices([...selectedItemIndices, index])
    }
  }
  
  const handleSelectAllItems = () => {
    if (selectedItemIndices.length === localData.invoiceItems.length) {
      setSelectedItemIndices([])
    } else {
      setSelectedItemIndices(localData.invoiceItems.map((_, i) => i))
    }
  }
  
  // Hər sətir üçün məhsul axtarışı
  const getFilteredProductsForRow = (searchTerm: string) => {
    if (!searchTerm.trim()) return []
    const term = searchTerm.toLowerCase()
    return products.filter(product =>
      product.name.toLowerCase().includes(term) ||
      product.code?.toLowerCase().includes(term) ||
      product.barcode?.toLowerCase().includes(term)
    ).slice(0, 10)
  }
  
  const handleProductSearchInRow = (index: number, searchTerm: string) => {
    const updatedItems = [...localData.invoiceItems]
    updatedItems[index] = {
      ...updatedItems[index],
      searchTerm: searchTerm
    }
    setLocalData({ ...localData, invoiceItems: updatedItems })
  }
  
  const handleProductSelectInRow = (index: number, productId: number) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    const updatedItems = [...localData.invoiceItems]
    const price = isPurchase ? (product.purchase_price || 0) : (product.sale_price || 0)
    updatedItems[index] = {
      ...updatedItems[index],
      product_id: productId,
      product_name: product.name,
      unit_price: price,
      total_price: updatedItems[index].quantity * price,
      searchTerm: ''
    }
    setLocalData({ ...localData, invoiceItems: updatedItems })
  }
  
  // Sort fonksiyonu
  // Sütun sürüşdürmə funksiyaları
  const handleColumnDragStart = (e: React.DragEvent, columnKey: string) => {
    if (!enableColumnDrag) return
    setDraggedColumnKey(columnKey)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleColumnDragOver = (e: React.DragEvent) => {
    if (!enableColumnDrag) return
    e.preventDefault()
    e.stopPropagation()
  }

  const handleColumnDrop = (e: React.DragEvent, targetColumnKey: string) => {
    if (!enableColumnDrag || !draggedColumnKey || draggedColumnKey === targetColumnKey) {
      setDraggedColumnKey(null)
      return
    }
    e.preventDefault()
    e.stopPropagation()

    const updatedColumns = [...tableColumns]
    const draggedCol = updatedColumns.find(col => col.id === draggedColumnKey)
    const targetCol = updatedColumns.find(col => col.id === targetColumnKey)

    if (!draggedCol || !targetCol) {
      setDraggedColumnKey(null)
      return
    }

    const draggedOrder = draggedCol.order
    const targetOrder = targetCol.order

    // Sütun sırasını dəyişdir
    updatedColumns.forEach(col => {
      if (col.id === draggedColumnKey) {
        col.order = targetOrder
      } else if (draggedOrder < targetOrder) {
        if (col.order > draggedOrder && col.order <= targetOrder) {
          col.order = col.order - 1
        }
      } else {
        if (col.order >= targetOrder && col.order < draggedOrder) {
          col.order = col.order + 1
        }
      }
    })

    setTableColumns(updatedColumns)
    setDraggedColumnKey(null)
  }

  const handleColumnDragEnd = () => {
    setDraggedColumnKey(null)
  }

  const handleSort = (column: string) => {
    if (enableColumnDrag) return // Sürüşdürmə aktivdirsə, sıralama işləməsin
    const newDirection = sortColumn === column && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortColumn(column)
    setSortDirection(newDirection)
    
    const sortedItems = [...localData.invoiceItems].sort((a, b) => {
      let aVal: any
      let bVal: any
      
      switch (column) {
        case 'product':
          aVal = a.product_name || ''
          bVal = b.product_name || ''
          break
        case 'code':
          aVal = getProductInfo(a.product_id).code || ''
          bVal = getProductInfo(b.product_id).code || ''
          break
        case 'barcode':
          aVal = getProductInfo(a.product_id).barcode || ''
          bVal = getProductInfo(b.product_id).barcode || ''
          break
        case 'unit':
          aVal = getProductInfo(a.product_id).unit || ''
          bVal = getProductInfo(b.product_id).unit || ''
          break
        case 'quantity':
          aVal = a.quantity || 0
          bVal = b.quantity || 0
          break
        case 'unitPrice':
          aVal = a.unit_price || 0
          bVal = b.unit_price || 0
          break
        case 'total':
          aVal = a.total_price || 0
          bVal = b.total_price || 0
          break
        default:
          return 0
      }
      
      if (typeof aVal === 'string') {
        return newDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      } else {
        return newDirection === 'asc' 
          ? aVal - bVal
          : bVal - aVal
      }
    })
    
    setLocalData({ ...localData, invoiceItems: sortedItems })
  }
 
  const invoiceTotal = useMemo(() => {
    return localData.invoiceItems.reduce((sum, item) => sum + (item.total_price || 0), 0)
  }, [localData.invoiceItems])
  
  // Sütunları sıralı olarak al
  const getSortedColumns = () => {
    return Object.entries(columnConfig)
      .sort(([, a], [, b]) => a.order - b.order)
      .map(([key]) => key)
  }
  
  // Məhsul bilgilerini al
  const getProductInfo = (productId: number | null) => {
    if (!productId) return { code: '', barcode: '', unit: '' }
    const product = products.find(p => p.id === productId)
    return {
      code: product?.code || '',
      barcode: product?.barcode || '',
      unit: product?.unit || ''
    }
  }
  
  // Modal açılanda məlumatları yenilə
  useEffect(() => {
    setLocalData(modal.data)
    if (modal.data.selectedCustomer) {
      setCustomerSearchTerm('')
    }
    if (modal.data.selectedSupplier) {
      setSupplierSearchTerm('')
    }
  }, [modal.data])
  
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.classList.contains('modal-header') || target.closest('.modal-header')) {
      if (target.tagName === 'BUTTON' || target.closest('button')) return
      setIsDragging(true)
      const currentPosition = windowInfo?.position || modal.position
      setDragStart({ x: e.clientX - currentPosition.x, y: e.clientY - currentPosition.y })
    }
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    const currentSize = effectiveSize
    setResizeStart({ 
      x: e.clientX, 
      y: e.clientY 
    })
    setResizeStartSize({ width: currentSize.width, height: currentSize.height })
    setLocalSize(null) // Reset local size
  }

  useEffect(() => {
    if (!isDragging && !isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !modal.isMaximized) {
        const currentSize = effectiveSize
        const newX = Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - currentSize.width))
        const newY = Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - currentSize.height))
        onUpdate(modal.id, { position: { x: newX, y: newY } })
        updateWindow(windowId, { position: { x: newX, y: newY } })
      }
      if (isResizing && !modal.isMaximized) {
        const currentPosition = effectivePosition
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y
        const newWidth = Math.max(500, Math.min(resizeStartSize.width + deltaX, window.innerWidth - currentPosition.x))
        const newHeight = Math.max(400, Math.min(resizeStartSize.height + deltaY, window.innerHeight - currentPosition.y))
        // Sadece görsel güncelleme - local state kullan
        setLocalSize({ width: newWidth, height: newHeight })
      }
    }

    const handleMouseUp = () => {
      if (isResizing && localSize) {
        // Mouse bırakıldığında gerçek state'i güncelle
        onUpdate(modal.id, { size: localSize })
        updateWindow(windowId, { size: localSize })
        setLocalSize(null)
      }
      setIsDragging(false)
      setIsResizing(false)
    }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
  }, [isDragging, isResizing, dragStart, resizeStart, resizeStartSize, localSize, modal.id, modal.isMaximized, effectivePosition, effectiveSize, onUpdate, windowId, updateWindow])

  const handleMaximize = () => {
    if (!modal.isMaximized) {
      // Navbar və taskbar yüksəklikləri
      // Navbar'ın gerçek yüksekliğini DOM'dan al
      const navbar = document.querySelector('nav')
      const navbarHeight = navbar ? navbar.offsetHeight : 60
      const taskbarHeight = 50 // Taskbar yüksəkliyi
      const availableHeight = window.innerHeight - navbarHeight - taskbarHeight
      
      onUpdate(modal.id, {
        isMaximized: true,
        position: { x: 0, y: navbarHeight },
        size: { width: window.innerWidth, height: availableHeight }
      })
    } else {
      const savedSize = localStorage.getItem('satis-qaime-modal-size')
      const defaultSize = savedSize ? JSON.parse(savedSize) : { width: 900, height: 600 }
      onUpdate(modal.id, {
        isMaximized: false,
        size: defaultSize,
        position: {
          x: (window.innerWidth - defaultSize.width) / 2,
          y: (window.innerHeight - defaultSize.height) / 2
        }
      })
    }
  }

  const totalAmount = localData.invoiceItems.reduce((sum, item) => sum + Number(item.total_price || 0), 0)

  // OK düyməsi funksiyası - yadda saxla, təsdiqlə və bağla
  const handleOK = async () => {
    try {
      if (onSaveAndConfirm) {
        // OK düyməsi - yadda saxla və təsdiqlə
        await onSaveAndConfirm(modal.id, localData)
      } else {
        // Əgər onSaveAndConfirm yoxdursa, sadəcə yadda saxla
        await onSave(modal.id, localData)
      }
      // Uğurla yadda saxlanıldıqdan sonra modalı bağla
      onClose(modal.id)
    } catch (error) {
      // Xəta baş verərsə, modal açıq qalır (xəta mesajı onSave içində göstərilir)
      console.error('Qaimə yadda saxlanılarkən xəta:', error)
    }
  }

  // Modal içində qısa yollar
  useEffect(() => {
    console.log('[InvoiceModal] useEffect - isVisible:', isVisible, 'isMinimized:', isMinimized, 'isActive:', isActive)
    if (!isVisible || isMinimized || !isActive) {
      console.log('[InvoiceModal] useEffect - Skipping keyboard handler setup')
      return
    }

    console.log('[InvoiceModal] Setting up keyboard handler')

    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('[InvoiceModal] Key pressed:', e.key, 'keyCode:', e.keyCode, 'code:', e.code, 'target:', e.target)
      
      // ESC: Modalı bağla (hər yerdə işləsin, ən əvvəl yoxla)
      // ESC key-in müxtəlif formatlarını yoxla
      if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27 || e.code === 'Escape') {
        console.log('[InvoiceModal] ESC detected - closing modal:', modal.id)
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        console.log('[InvoiceModal] Calling onClose with modal.id:', modal.id)
        onClose(modal.id)
        console.log('[InvoiceModal] onClose called')
        return
      }

      // Input və textarea elementlərində qısa yolları deaktiv et (Ctrl+S, Ctrl+P istisna)
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      // Ctrl+S: Yadda Saxla (hər yerdə işləsin)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        onSave(modal.id, localData)
        return
      }

      // Ctrl+P: Çap et (hər yerdə işləsin, əgər onPrint varsa)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        if (onPrint) {
          onPrint(modal.id, localData)
        }
        return
      }

      // F4 - Müştərilər səhifəsini aç
      if (e.key === 'F4' && !isPurchase && isActive) {
        e.preventDefault()
        navigate('/musteriler/alici')
        // Müştəri seçildikdə geri qayıtmaq üçün event listener əlavə et
        const handleCustomerSelected = (event: CustomEvent) => {
          const customer = event.detail as Customer
          setLocalData({ 
            ...localData, 
            selectedCustomerId: customer.id, 
            selectedCustomer: customer 
          })
          window.removeEventListener('customerSelected', handleCustomerSelected as EventListener)
        }
        window.addEventListener('customerSelected', handleCustomerSelected as EventListener)
        return
      }

      // Input içində digər qısa yollar işləməsin
      if (isInput) {
        return
      }

      // Insert: Yeni sətir əlavə et
      if (e.key === 'Insert') {
        e.preventDefault()
        handleAddEmptyRow()
        return
      }

      // Delete: Seçilmiş sətirləri sil
      if (e.key === 'Delete') {
        e.preventDefault()
        if (selectedItemIndices.length > 0) {
          const sortedIndices = [...selectedItemIndices].sort((a, b) => b - a)
          const newItems = [...localData.invoiceItems]
          sortedIndices.forEach(index => {
            newItems.splice(index, 1)
          })
          setLocalData({ ...localData, invoiceItems: newItems })
          setSelectedItemIndices([])
        }
        return
      }

      // F9: Seçilmiş sətirləri kopyala
      if (e.key === 'F9') {
        e.preventDefault()
        if (selectedItemIndices.length > 0) {
          const sortedIndices = [...selectedItemIndices].sort((a, b) => a - b)
          const newItems = [...localData.invoiceItems]
          const copiedItems = sortedIndices.map(index => ({ ...newItems[index] }))
          setLocalData({ ...localData, invoiceItems: [...newItems, ...copiedItems] })
        }
        return
      }
    }

    // Capture fazasında da dinlə (başqa listener-lardan əvvəl işləsin)
    window.addEventListener('keydown', handleKeyDown, true)
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [isVisible, isMinimized, modal.id, onClose, onSave, onPrint, localData, selectedItemIndices, handleAddEmptyRow, isPurchase, isActive, navigate])

  // Minimize olunmuşsa göstərmə
  if (isMinimized || !isVisible) {
    return null
  }
  
  // Modal z-index navbar (1000) və taskbar (10000) arasında olmalı
  const modalZIndex = Math.min(Math.max(modal.zIndex, 1001), 9999)
  
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.3)',
        zIndex: modalZIndex,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${effectivePosition.x}px`,
          top: `${effectivePosition.y}px`,
          width: `${effectiveSize.width}px`,
          height: `${effectiveSize.height}px`,
          background: 'white',
          borderRadius: modal.isMaximized ? '0' : '8px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
        data-modal-container
        onClick={(e) => {
          e.stopPropagation()
          if (!isActive) {
            onActivate(modal.id)
          }
        }}
      >
        {/* Modal başlığı */}
        <div
          className="modal-header"
          onMouseDown={handleMouseDown}
          style={{
            padding: '1rem',
            borderBottom: '1px solid #ddd',
            cursor: isDragging ? 'grabbing' : 'grab',
            background: '#f8f9fa',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', flex: 1 }}>
            {modal.invoiceId 
              ? `Qaimə #${modal.invoiceId}` 
              : modal.invoiceType === 'purchase' 
                ? 'Yeni Alış Qaiməsi' 
                : 'Yeni Satış Qaiməsi'}
          </h2>
          <div style={{ display: 'flex', gap: '0', alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => {
                minimizeWindow(windowId)
                onUpdate(modal.id, { isMaximized: false })
              }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '0',
                color: '#666',
                width: '46px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e5e5'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
              title="Aşağı göndər"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect y="5" width="12" height="1" fill="currentColor"/>
              </svg>
            </button>
            <button
              onClick={handleMaximize}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '0',
                color: '#666',
                width: '46px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e5e5e5'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
              title={modal.isMaximized ? "Bərpa et" : "Böyüt"}
            >
              {modal.isMaximized ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="8" height="8" stroke="currentColor" strokeWidth="1" fill="none"/>
                  <rect x="4" y="4" width="6" height="6" stroke="currentColor" strokeWidth="1" fill="none"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1" y="1" width="10" height="10" stroke="currentColor" strokeWidth="1" fill="none"/>
                </svg>
              )}
            </button>
            <button
              onClick={() => onClose(modal.id)}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '0',
                color: '#666',
                width: '46px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease, color 0.15s ease',
                lineHeight: '1',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e81123'
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = '#666'
              }}
              title="Bağla"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
        
        {/* Modal məzmunu */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '1rem', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {/* Qaimə nömrəsi və tarixi */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500', fontSize: '0.875rem' }}>
                Qaimə nömrəsi
              </label>
              <input
                type="text"
                placeholder="Qaimə nömrəsi"
                value={localData.invoiceNumber || ''}
                onChange={(e) => {
                  setLocalData({ ...localData, invoiceNumber: e.target.value })
                }}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.875rem'
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500', fontSize: '0.875rem' }}>
                Qaimə tarixi
              </label>
              <input
                type="text"
                placeholder="YYYY-MM-DD HH:MM:SS"
                value={localData.invoiceDate || ''}
                onChange={(e) => {
                  setLocalData({ ...localData, invoiceDate: e.target.value })
                }}
                style={{
                  width: '100%',
                  padding: '0.35rem 0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          </div>

          {/* Müştəri və Son ödəniş tarixi - yan-yana */}
          {!isPurchase ? (
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {/* Müştəri */}
            <div style={{ flex: 1, position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500', fontSize: '0.875rem' }}>
                Müştəri
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/musteriler/alici')
                    // Müştəri seçildikdə geri qayıtmaq üçün event listener əlavə et
                    const handleCustomerSelected = (event: CustomEvent) => {
                      const customer = event.detail as Customer
                      setLocalData({ 
                        ...localData, 
                        selectedCustomerId: customer.id, 
                        selectedCustomer: customer 
                      })
                      window.removeEventListener('customerSelected', handleCustomerSelected as EventListener)
                    }
                    window.addEventListener('customerSelected', handleCustomerSelected as EventListener)
                  }}
                  style={{
                    padding: '0.35rem 0.5rem',
                    background: '#f8f9fa',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                  title="Müştərilər səhifəsini aç (F4)"
                >
                  📁
                </button>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Müştəri adını yazın..."
                    value={localData.selectedCustomer ? localData.selectedCustomer.name : customerSearchTerm}
                    data-customer-input="true"
                    onChange={(e) => {
                      const value = e.target.value
                      setCustomerSearchTerm(value)
                      setShowCustomerDropdown(value.length > 0)
                      if (!value) {
                        setLocalData({ ...localData, selectedCustomerId: null, selectedCustomer: null })
                        setShowCustomerDropdown(false)
                      }
                    }}
                    onFocus={() => {
                      if (customerSearchTerm && !localData.selectedCustomer) {
                        setShowCustomerDropdown(true)
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowCustomerDropdown(false), 200)
                    }}
                    style={{
                      width: '100%',
                      padding: '0.35rem 0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '0.875rem'
                    }}
                  />
                  {showCustomerDropdown && filteredCustomers.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      marginTop: '0.25rem',
                      maxHeight: '200px',
                      overflow: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                      {filteredCustomers.map(customer => (
                        <div
                          key={customer.id}
                          onClick={() => {
                            setLocalData({ ...localData, selectedCustomerId: customer.id, selectedCustomer: customer })
                            setCustomerSearchTerm('')
                            setShowCustomerDropdown(false)
                          }}
                          style={{
                            padding: '0.75rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f0f0f0'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f8f9fa'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white'
                          }}
                        >
                          <div style={{ fontWeight: 'bold' }}>{customer.name}</div>
                          {customer.phone && <div style={{ fontSize: '0.875rem', color: '#666' }}>Tel: {customer.phone}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {localData.selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalData({ ...localData, selectedCustomerId: null, selectedCustomer: null })
                      setCustomerSearchTerm('')
                      setShowCustomerDropdown(false)
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      flexShrink: 0
                    }}
                    title="Təmizlə"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            
            {/* Son ödəniş tarixi */}
            {localData.paymentDate !== undefined && (
            <div style={{ flex: 1, position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500', fontSize: '0.875rem' }}>
                Son ödəniş tarixi
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="15, 15.11 və ya 15.11.2025 formatında daxil edin..."
                  value={localData.paymentDate || ''}
                  onChange={(e) => {
                    setLocalData({ ...localData, paymentDate: e.target.value })
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const value = e.currentTarget.value.trim()
                      if (value) {
                        const formatted = formatDateInput(value)
                        if (formatted) {
                          setLocalData({ ...localData, paymentDate: formatted })
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.trim()
                    if (value) {
                      const formatted = formatDateInput(value)
                      if (formatted) {
                        setLocalData({ ...localData, paymentDate: formatted })
                      }
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '0.35rem 0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '0.875rem'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  style={{
                    padding: '0.35rem 0.5rem',
                    background: '#f8f9fa',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                  title="Tarix seç"
                >
                  📅
                </button>
                {showDatePicker && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.25rem',
                    background: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    zIndex: 1000,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}>
                    <input
                      type="date"
                      value={localData.paymentDate ? localData.paymentDate.split(' ')[0] : ''}
                      onChange={(e) => {
                        const dateValue = e.target.value
                        if (dateValue) {
                          const timePart = localData.paymentDate?.split(' ')[1] || '00:00:00'
                          setLocalData({ ...localData, paymentDate: `${dateValue} ${timePart}` })
                        } else {
                          setLocalData({ ...localData, paymentDate: '' })
                        }
                        setShowDatePicker(false)
                      }}
                      style={{
                        padding: '0.25rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '0.875rem'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
          ) : (
            <div style={{ marginBottom: '0.75rem', position: 'relative' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500', fontSize: '0.875rem' }}>
                Təchizatçı
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Təchizatçı adını yazın..."
                    value={localData.selectedSupplier ? localData.selectedSupplier.name : supplierSearchTerm}
                    data-supplier-input="true"
                    onChange={(e) => {
                      const value = e.target.value
                      setSupplierSearchTerm(value)
                      setShowSupplierDropdown(value.length > 0)
                      if (!value) {
                        setLocalData({ ...localData, selectedSupplierId: null, selectedSupplier: null })
                        setShowSupplierDropdown(false)
                      }
                    }}
                    onFocus={() => {
                      if (supplierSearchTerm && !localData.selectedSupplier) {
                        setShowSupplierDropdown(true)
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowSupplierDropdown(false), 200)
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem'
                    }}
                  />
                  {showSupplierDropdown && filteredSuppliers.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'white',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      marginTop: '0.25rem',
                      maxHeight: '200px',
                      overflow: 'auto',
                      zIndex: 1000,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}>
                      {filteredSuppliers.map(supplier => (
                        <div
                          key={supplier.id}
                          onClick={() => {
                            setLocalData({ ...localData, selectedSupplierId: supplier.id, selectedSupplier: supplier })
                            setSupplierSearchTerm('')
                            setShowSupplierDropdown(false)
                          }}
                          style={{
                            padding: '0.75rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f0f0f0'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f8f9fa'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white'
                          }}
                        >
                          <div style={{ fontWeight: 'bold' }}>{supplier.name}</div>
                          {supplier.phone && <div style={{ fontSize: '0.875rem', color: '#666' }}>Tel: {supplier.phone}</div>}
                        </div>
                      ))}
              </div>
            )}
          </div>
                {localData.selectedSupplier && (
                  <button
                    type="button"
                    onClick={() => {
                      setLocalData({ ...localData, selectedSupplierId: null, selectedSupplier: null })
                      setSupplierSearchTerm('')
                      setShowSupplierDropdown(false)
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}
                    title="Təmizlə"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}


          {/* Məhsul siyahısı */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden', minHeight: 0 }}>
            {/* Toolbar */}
            <div style={{ background: '#f8f9fa', padding: '0.5rem', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>Məhsullar ({localData.invoiceItems.length})</div>
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                {/* Add icon */}
                <button
                  onClick={handleAddEmptyRow}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e9ecef'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                  style={{
                    padding: '0.5rem',
                    background: 'transparent',
                    color: '#28a745',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    transition: 'background-color 0.2s ease'
                  }}
                  title="Əlavə et (Insert)"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
                
                {/* Delete icon */}
                <button
                  onClick={() => {
                    const sortedIndices = [...selectedItemIndices].sort((a, b) => b - a)
                    const newItems = [...localData.invoiceItems]
                    sortedIndices.forEach(index => {
                      newItems.splice(index, 1)
                    })
                    setLocalData({ ...localData, invoiceItems: newItems })
                    setSelectedItemIndices([])
                  }}
                  disabled={selectedItemIndices.length === 0}
                  onMouseEnter={(e) => {
                    if (selectedItemIndices.length > 0) {
                      e.currentTarget.style.background = '#e9ecef'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = selectedItemIndices.length === 0 ? '#e9ecef' : 'transparent'
                  }}
                  style={{
                    padding: '0.5rem',
                    background: selectedItemIndices.length === 0 ? '#e9ecef' : 'transparent',
                    color: selectedItemIndices.length === 0 ? '#adb5bd' : '#dc3545',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: selectedItemIndices.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    transition: 'background-color 0.2s ease'
                  }}
                  title="Sil (Delete)"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3 4H13M6 4V3C6 2.44772 6.44772 2 7 2H9C9.55228 2 10 2.44772 10 3V4M6 7.5V11.5M10 7.5V11.5M4 4L4.5 13C4.5 13.5523 4.94772 14 5.5 14H10.5C11.0523 14 11.5 13.5523 11.5 13L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
                
                {/* Copy icon */}
              <button
                  onClick={() => {
                    if (selectedItemIndices.length > 0) {
                      const sortedIndices = [...selectedItemIndices].sort((a, b) => a - b)
                      const newItems = [...localData.invoiceItems]
                      const copiedItems = sortedIndices.map(index => ({ ...newItems[index] }))
                      setLocalData({ ...localData, invoiceItems: [...newItems, ...copiedItems] })
                    }
                  }}
                  disabled={selectedItemIndices.length === 0}
                  onMouseEnter={(e) => {
                    if (selectedItemIndices.length > 0) {
                      e.currentTarget.style.background = '#e9ecef'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = selectedItemIndices.length === 0 ? '#e9ecef' : 'transparent'
                  }}
                style={{
                  padding: '0.5rem',
                    background: selectedItemIndices.length === 0 ? '#e9ecef' : 'transparent',
                    color: selectedItemIndices.length === 0 ? '#adb5bd' : '#495057',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: selectedItemIndices.length === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    transition: 'background-color 0.2s ease'
                  }}
                  title="Kopyala (F9)"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 2C4 0.895431 4.89543 0 6 0H10C11.1046 0 12 0.895431 12 2V6C12 7.10457 11.1046 8 10 8H6C4.89543 8 4 7.10457 4 6V2Z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M4 6H2C0.895431 6 0 6.89543 0 8V12C0 13.1046 0.895431 14 2 14H6C7.10457 14 8 13.1046 8 12V10" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </button>
                
                {/* Move up icon */}
                <button
                  onClick={() => {
                    if (selectedItemIndices.length === 1) {
                      const index = selectedItemIndices[0]
                      if (index > 0) {
                        const newItems = [...localData.invoiceItems]
                        const temp = newItems[index]
                        newItems[index] = newItems[index - 1]
                        newItems[index - 1] = temp
                        setLocalData({ ...localData, invoiceItems: newItems })
                        setSelectedItemIndices([index - 1])
                      }
                    }
                  }}
                  disabled={selectedItemIndices.length !== 1 || selectedItemIndices[0] === 0}
                  onMouseEnter={(e) => {
                    if (selectedItemIndices.length === 1 && selectedItemIndices[0] > 0) {
                      e.currentTarget.style.background = '#e9ecef'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = (selectedItemIndices.length !== 1 || selectedItemIndices[0] === 0) ? '#e9ecef' : 'transparent'
                  }}
                  style={{
                    padding: '0.5rem',
                    background: (selectedItemIndices.length !== 1 || selectedItemIndices[0] === 0) ? '#e9ecef' : 'transparent',
                    color: (selectedItemIndices.length !== 1 || selectedItemIndices[0] === 0) ? '#adb5bd' : '#495057',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (selectedItemIndices.length !== 1 || selectedItemIndices[0] === 0) ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    transition: 'background-color 0.2s ease'
                  }}
                  title="Yuxarı"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 12V4M8 4L4 8M8 4L12 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                
                {/* Move down icon */}
                <button
                  onClick={() => {
                    if (selectedItemIndices.length === 1) {
                      const index = selectedItemIndices[0]
                      if (index < localData.invoiceItems.length - 1) {
                        const newItems = [...localData.invoiceItems]
                        const temp = newItems[index]
                        newItems[index] = newItems[index + 1]
                        newItems[index + 1] = temp
                        setLocalData({ ...localData, invoiceItems: newItems })
                        setSelectedItemIndices([index + 1])
                      }
                    }
                  }}
                  disabled={selectedItemIndices.length !== 1 || selectedItemIndices[0] === localData.invoiceItems.length - 1}
                  onMouseEnter={(e) => {
                    if (selectedItemIndices.length === 1 && selectedItemIndices[0] < localData.invoiceItems.length - 1) {
                      e.currentTarget.style.background = '#e9ecef'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = (selectedItemIndices.length !== 1 || selectedItemIndices[0] === localData.invoiceItems.length - 1) ? '#e9ecef' : 'transparent'
                  }}
                  style={{
                    padding: '0.5rem',
                    background: (selectedItemIndices.length !== 1 || selectedItemIndices[0] === localData.invoiceItems.length - 1) ? '#e9ecef' : 'transparent',
                    color: (selectedItemIndices.length !== 1 || selectedItemIndices[0] === localData.invoiceItems.length - 1) ? '#adb5bd' : '#495057',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (selectedItemIndices.length !== 1 || selectedItemIndices[0] === localData.invoiceItems.length - 1) ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    transition: 'background-color 0.2s ease'
                  }}
                  title="Aşağı"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 4V12M8 12L4 8M8 12L12 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                
                {/* Barcode icon */}
                <button
                  onClick={() => {
                    // Barkod funksiyası
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e9ecef'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                  style={{
                    padding: '0.5rem',
                    background: 'transparent',
                    color: '#495057',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    transition: 'background-color 0.2s ease'
                  }}
                  title="Barkod"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 4H2M1 8H2M1 12H2M4 4H5M4 8H5M4 12H5M7 4H8M7 8H8M7 12H8M10 4H11M10 8H11M10 12H11M13 4H14M13 8H14M13 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
                
                {/* Folder icon */}
                <button
                  onClick={() => {
                    // Papka funksiyası
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e9ecef'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                  style={{
                    padding: '0.5rem',
                    background: 'transparent',
                    color: '#495057',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    transition: 'background-color 0.2s ease'
                  }}
                  title="Papka"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 3C2 2.44772 2.44772 2 3 2H6.58579C6.851 2 7.10536 2.10536 7.29289 2.29289L8.70711 3.70711C8.89464 3.89464 9.149 4 9.41421 4H13C13.5523 4 14 4.44772 14 5V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13V3Z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </button>
                
                {/* Settings icon */}
                <button
                  onClick={() => {
                    setShowItemSettingsModal(true)
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e9ecef'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                  style={{
                    padding: '0.5rem',
                    background: 'transparent',
                    color: '#495057',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    transition: 'background-color 0.2s ease'
                  }}
                  title="Ayarlar"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M12.5 8C12.5 7.5 12.7 7 12.9 6.6L13.8 5.1C14 4.7 13.9 4.2 13.5 3.9L12.1 2.9C11.7 2.6 11.2 2.6 10.8 2.9L9.8 3.5C9.4 3.3 9 3.1 8.5 3.1H7.5C7 3.1 6.6 3.3 6.2 3.5L5.2 2.9C4.8 2.6 4.3 2.6 3.9 2.9L2.5 3.9C2.1 4.2 2 4.7 2.2 5.1L3.1 6.6C3.3 7 3.1 7.5 3.1 8C3.1 8.5 3.3 9 3.1 9.4L2.2 10.9C2 11.3 2.1 11.8 2.5 12.1L3.9 13.1C4.3 13.4 4.8 13.4 5.2 13.1L6.2 12.5C6.6 12.7 7 12.9 7.5 12.9H8.5C9 12.9 9.4 12.7 9.8 12.5L10.8 13.1C11.2 13.4 11.7 13.4 12.1 13.1L13.5 12.1C13.9 11.8 14 11.3 13.8 10.9L12.9 9.4C12.7 9 12.5 8.5 12.5 8Z" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
              </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 10 }}>
                    {visibleOrderedColumns.map((column) => {
                      if (column.id === 'checkbox') {
                        return (
                          <th
                            key="checkbox"
                            style={{
                              padding: '0.75rem',
                              border: '1px solid #ddd',
                              textAlign: 'center',
                              fontSize: '0.875rem',
                              width: `${columnConfig.checkbox.width}px`
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedItemIndices.length === localData.invoiceItems.length && localData.invoiceItems.length > 0}
                              onChange={() => {
                                if (selectedItemIndices.length === localData.invoiceItems.length) {
                                  setSelectedItemIndices([])
                                } else {
                                  setSelectedItemIndices(localData.invoiceItems.map((_, i) => i))
                                }
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                          </th>
                        )
                      }

                      const dragProps = enableColumnDrag ? {
                        draggable: true,
                        onDragStart: (e: React.DragEvent) => handleColumnDragStart(e, column.id),
                        onDragOver: handleColumnDragOver,
                        onDrop: (e: React.DragEvent) => handleColumnDrop(e, column.id),
                        onDragEnd: handleColumnDragEnd
                      } : {}

                      const isRightAligned = ['quantity', 'unitPrice', 'total'].includes(column.id)

                      const commonStyle: React.CSSProperties = {
                        padding: '0.75rem',
                        border: '1px solid #ddd',
                        fontSize: '0.875rem',
                        cursor: enableColumnDrag ? 'grab' : 'pointer',
                        opacity: draggedColumnKey === column.id ? 0.5 : 1,
                        userSelect: 'none',
                        width: `${columnConfig[column.id]?.width || 120}px`,
                        textAlign: isRightAligned ? 'right' : 'left'
                      }

                      const renderSortIcon = (columnId: string) => {
                        if (sortColumn !== columnId) {
                          return (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.5 }}>
                              <path d="M3 4.5L6 1.5L9 4.5M3 7.5L6 10.5L9 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )
                        }

                        return sortDirection === 'asc' ? (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 4.5L6 1.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 7.5L6 10.5L9 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )
                      }

                      const headerContent = () => {
                        switch (column.id) {
                          case 'number':
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                №
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.5 }}>
                                  <path d="M3 4.5L6 1.5L9 4.5M3 7.5L6 10.5L9 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                            )
                          case 'product':
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                Məhsul
                                {renderSortIcon('product')}
                              </div>
                            )
                          case 'code':
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                Kod
                                {renderSortIcon('code')}
                              </div>
                            )
                          case 'barcode':
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                Barkod
                                {renderSortIcon('barcode')}
                              </div>
                            )
                          case 'unit':
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                Vahid
                                {renderSortIcon('unit')}
                              </div>
                            )
                          case 'quantity':
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                                Miqdar
                                {renderSortIcon('quantity')}
                              </div>
                            )
                          case 'unitPrice':
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                                Vahid qiymət
                                {renderSortIcon('unitPrice')}
                              </div>
                            )
                          case 'total':
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                                Cəm
                                {renderSortIcon('total')}
                              </div>
                            )
                          default:
                            return null
                        }
                      }

                      const handleHeaderClick = () => {
                        switch (column.id) {
                          case 'product':
                          case 'code':
                          case 'barcode':
                          case 'unit':
                          case 'quantity':
                          case 'unitPrice':
                          case 'total':
                            handleSort(column.id)
                            break
                          default:
                            break
                        }
                      }

                      return (
                        <th
                          key={column.id}
                          {...dragProps}
                          style={commonStyle}
                          onClick={handleHeaderClick}
                        >
                          {headerContent()}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {localData.invoiceItems.map((item, idx) => {
                    const rowProducts = getFilteredProductsForRow(item.searchTerm || '')
                    const isSelected = selectedItemIndices.includes(idx)
                    return (
                      <tr
                        key={idx}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'BUTTON') {
                            if (e.ctrlKey || e.metaKey) {
                              if (selectedItemIndices.includes(idx)) {
                                setSelectedItemIndices(selectedItemIndices.filter(i => i !== idx))
                              } else {
                                setSelectedItemIndices([...selectedItemIndices, idx])
                              }
                            } else {
                              setSelectedItemIndices([idx])
                            }
                          }
                        }}
                        style={{
                          background: isSelected ? '#e7f3ff' : (idx % 2 === 0 ? 'white' : '#f9f9f9'),
                          cursor: 'pointer'
                        }}
                      >
                        {visibleOrderedColumns.map((column) => {
                          switch (column.id) {
                            case 'checkbox':
                              return (
                                <td key={`checkbox-${idx}`} style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {}}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (e.ctrlKey || e.metaKey) {
                                        if (selectedItemIndices.includes(idx)) {
                                          setSelectedItemIndices(selectedItemIndices.filter(i => i !== idx))
                                        } else {
                                          setSelectedItemIndices([...selectedItemIndices, idx])
                                        }
                                      } else {
                                        setSelectedItemIndices([idx])
                                      }
                                    }}
                                    style={{ cursor: 'pointer' }}
                                  />
                                </td>
                              )
                            case 'number':
                              return (
                                <td key={`number-${idx}`} style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center' }}>
                                  {idx + 1}
                                </td>
                              )
                            case 'product':
                              return (
                                <td key={`product-${idx}`} style={{ padding: '0.75rem', border: '1px solid #ddd', position: 'relative' }}>
                                  {item.product_id ? (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span>{item.product_name}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const updatedItems = [...localData.invoiceItems]
                                          updatedItems[idx] = {
                                            ...updatedItems[idx],
                                            product_id: null,
                                            product_name: '',
                                            searchTerm: ''
                                          }
                                          setLocalData({ ...localData, invoiceItems: updatedItems })
                                        }}
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: '#dc3545',
                                          cursor: 'pointer',
                                          fontSize: '1rem',
                                          padding: '0.25rem',
                                          marginLeft: '0.5rem'
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ position: 'relative' }}>
                                      <input
                                        type="text"
                                        placeholder="Məhsul adını yazın..."
                                        value={item.searchTerm || ''}
                                        onChange={(e) => handleProductSearchInRow(idx, e.target.value)}
                                        onBlur={(e) => {
                                          setTimeout(() => {
                                            const relatedTarget = e.relatedTarget as HTMLElement
                                            if (!relatedTarget || !relatedTarget.closest('.product-dropdown')) {
                                              const updatedItems = [...localData.invoiceItems]
                                              updatedItems[idx] = {
                                                ...updatedItems[idx],
                                                searchTerm: ''
                                              }
                                              setLocalData({ ...localData, invoiceItems: updatedItems })
                                            }
                                          }, 200)
                                        }}
                                        style={{
                                          width: '100%',
                                          padding: '0.25rem',
                                          border: '1px solid #ddd',
                                          borderRadius: '4px',
                                          fontSize: '0.9rem'
                                        }}
                                      />
                                      {rowProducts.length > 0 && (
                                        <div
                                          className="product-dropdown"
                                          style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            background: 'white',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            marginTop: '0.25rem',
                                            maxHeight: '200px',
                                            overflow: 'auto',
                                            zIndex: 1000,
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                          }}
                                          onMouseDown={(e) => e.preventDefault()}
                                        >
                                          {rowProducts.map(product => (
                                            <div
                                              key={product.id}
                                              onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                handleProductSelectInRow(idx, product.id)
                                              }}
                                              style={{
                                                padding: '0.75rem',
                                                cursor: 'pointer',
                                                borderBottom: '1px solid #f0f0f0'
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.background = '#f8f9fa'
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'white'
                                              }}
                                            >
                                              <div style={{ fontWeight: 'bold' }}>{product.name}</div>
                                              <div style={{ fontSize: '0.875rem', color: '#666' }}>
                                                {product.code && <span>Kod: {product.code} </span>}
                                                {product.barcode && <span>Barkod: {product.barcode}</span>}
                                              </div>
                                              {isPurchase
                                                ? (product.purchase_price && (
                                                    <div style={{ fontSize: '0.875rem', color: '#28a745', fontWeight: 'bold', marginTop: '0.25rem' }}>
                                                      Qiymət: {Number(product.purchase_price).toFixed(2)} ₼
                                                    </div>
                                                  ))
                                                : product.sale_price && (
                                                    <div style={{ fontSize: '0.875rem', color: '#28a745', fontWeight: 'bold', marginTop: '0.25rem' }}>
                                                      Qiymət: {Number(product.sale_price).toFixed(2)} ₼
                                                    </div>
                                                  )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>
                              )
                            case 'code':
                              return (
                                <td key={`code-${idx}`} style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left' }}>
                                  {getProductInfo(item.product_id).code || '-'}
                                </td>
                              )
                            case 'barcode':
                              return (
                                <td key={`barcode-${idx}`} style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left' }}>
                                  {getProductInfo(item.product_id).barcode || '-'}
                                </td>
                              )
                            case 'unit':
                              return (
                                <td key={`unit-${idx}`} style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left' }}>
                                  {getProductInfo(item.product_id).unit || '-'}
                                </td>
                              )
                            case 'quantity':
                              return (
                                <td key={`quantity-${idx}`} style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      width: '100%',
                                      padding: '0.25rem',
                                      border: '1px solid #ddd',
                                      borderRadius: '4px',
                                      textAlign: 'right',
                                      fontSize: '0.9rem'
                                    }}
                                  />
                                </td>
                              )
                            case 'unitPrice':
                              return (
                                <td key={`unitPrice-${idx}`} style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.unit_price}
                                    onChange={(e) => handleUpdateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      width: '100%',
                                      padding: '0.25rem',
                                      border: '1px solid #ddd',
                                      borderRadius: '4px',
                                      textAlign: 'right',
                                      fontSize: '0.9rem'
                                    }}
                                  />
                                </td>
                              )
                            case 'total':
                              return (
                                <td key={`total-${idx}`} style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold' }}>
                                  {item.total_price.toFixed(2)} ₼
                                </td>
                              )
                            default:
                              return null
                          }
                        })}
                      </tr>
                    )
                  })}
                  {localData.invoiceItems.length === 0 && (
                    <tr>
                      <td colSpan={visibleColumnCount} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
                        Məhsul yoxdur. Əlavə edin.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#e7f3ff', fontWeight: 'bold' }}>
                    {visibleOrderedColumns.map((column) => {
                      if (column.id === 'unitPrice') {
                        return (
                          <td key="unitPrice-footer" style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'right' }}>
                            Ümumi:
                          </td>
                        )
                      }

                      if (column.id === 'total') {
                        return (
                          <td key="total-footer" style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'right' }}>
                            {invoiceTotal.toFixed(2)} ₼
                          </td>
                        )
                      }

                      return (
                        <td key={`${column.id}-footer`} style={{ padding: '0.5rem', border: '1px solid #ddd' }}></td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>

        {/* Ayarlar modalı */}
        <TableSettingsModal
          isOpen={showItemSettingsModal}
          onClose={() => setShowItemSettingsModal(false)}
          title="Cədvəl ayarları"
          columns={tableColumns}
          onColumnsChange={setTableColumns}
          defaultColumns={BASE_TABLE_COLUMNS}
          functionSettings={functionSettings}
          onFunctionSettingsChange={(settings) => {
            if (settings.enableColumnDrag !== undefined) {
              updateEnableColumnDrag(settings.enableColumnDrag)
            }
          }}
          showFunctionsTab={true}
          customFunctionContent={functionTabContent}
        />

        {/* Düymələr */}
        <div style={{ padding: '1rem', borderTop: '1px solid #ddd', display: 'flex', gap: '1rem', alignItems: 'center', flexShrink: 0 }}>
          {/* Qeydlər */}
          <div style={{ flex: 1 }}>
            <div style={{ 
              border: '1px solid #ddd',
              borderRadius: '4px',
              background: '#f8f9fa',
              padding: '0.35rem 0.5rem',
              display: 'flex',
              alignItems: 'center',
              height: '36px',
              boxSizing: 'border-box'
            }}>
              <textarea
                value={localData.notes}
                onChange={(e) => setLocalData({ ...localData, notes: e.target.value })}
                onFocus={() => setNotesFocused(true)}
                onBlur={() => {
                  if (!localData.notes) {
                    setNotesFocused(false)
                  }
                }}
                placeholder={notesFocused || localData.notes ? '' : 'Qeydlər'}
                style={{
                  width: '100%',
                  padding: '0',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  resize: 'none',
                  background: 'transparent',
                  outline: 'none',
                  height: '100%',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                  overflow: 'hidden'
                }}
              />
            </div>
          </div>
          
          {/* Düymələr */}
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            {onPrint && (
              <button
                onClick={() => onPrint(modal.id, localData)}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
                title="Çap et (Ctrl+P)"
              >
                🖨️ Çap et
              </button>
            )}
            <button
              onClick={() => onClose(modal.id)}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
              title="Bağla (ESC)"
            >
              Bağla
            </button>
            <button
              onClick={() => onSave(modal.id, localData)}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#17a2b8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
              title="Yadda Saxla (Ctrl+S)"
            >
              Yadda Saxla
            </button>
            <button
              onClick={handleOK}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              OK
            </button>
          </div>
        </div>

        {/* Resize handle */}
        {!modal.isMaximized && (
          <div
            onMouseDown={handleResizeMouseDown}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: '20px',
              height: '20px',
              cursor: 'nwse-resize',
              background: 'linear-gradient(135deg, transparent 0%, transparent 40%, #999 40%, #999 60%, transparent 60%)',
            }}
          />
        )}
      </div>
    </div>
  )
}

export default InvoiceModal

