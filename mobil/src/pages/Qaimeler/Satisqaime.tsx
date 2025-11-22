import { useState, useEffect, useRef } from 'react'
import Layout from '../../components/Layout'
import { ordersAPI, productsAPI, customersAPI } from '../../services/api'
import type { SaleInvoice, Product, Customer } from '@shared/types'
import InvoiceModal from './InvoiceModal'

// Köhnə satış qaimə nömrələrini yeni formata çevirən helper
const formatSaleInvoiceNumber = (raw: string | null | undefined): string => {
  if (!raw) return ''
  const str = String(raw)
  if (str.startsWith('SI-')) return str
  const match = str.match(/(\d+)/)
  if (!match) return str
  const num = Number(match[1])
  if (!Number.isFinite(num)) return str
  return `SI-${String(num).padStart(10, '0')}`
}

interface InvoiceItem {
  product_id: number | null
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  product_code?: string
  product_unit?: string
  product_barcode?: string
  product_article?: string
}

export default function SatisQaimeleri() {
  const [invoices, setInvoices] = useState<SaleInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchText, setSearchText] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [multiSelectMode, setMultiSelectMode] = useState(false) // Çoxlu seçim rejimi
  const [selectedInvoice, setSelectedInvoice] = useState<SaleInvoice | null>(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [customerSearch, setCustomerSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  
  // Toolbar state
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [settingsOpen] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'columns' | 'functions' | 'rows'>('columns')
  
  // Refs for toolbar and panels
  const toolbarRef = useRef<HTMLDivElement>(null)
  const searchPanelRef = useRef<HTMLDivElement>(null)
  const tableBodyScrollRef = useRef<HTMLDivElement>(null)
  const thRefs = useRef<Map<string, HTMLTableCellElement>>(new Map())
  const [toolbarHeight, setToolbarHeight] = useState(56)
  const [searchPanelHeight, setSearchPanelHeight] = useState(0)
  
  // Drag and resize state
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  
  // Table state
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
    checkbox: true,
    rowNumber: true,
    id: true,
    invoice_number: true,
    customer_name: true,
    invoice_date: true,
    total_amount: true,
    notes: true,
    is_active_status: true,
  })
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    checkbox: 50,
    rowNumber: 60,
    id: 100,
    invoice_number: 150,
    customer_name: 200,
    invoice_date: 120,
    total_amount: 150,
    notes: 200,
    is_active_status: 100,
  })
  const [columnOrder, setColumnOrder] = useState<string[]>([
    'checkbox',
    'is_active_status',
    'rowNumber',
    'id',
    'invoice_number',
    'customer_name',
    'invoice_date',
    'total_amount',
    'notes',
  ])
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  
  // Rows per page state
  const [rowsPerPage, setRowsPerPage] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('purchaseInvoiceTableRowsPerPage')
      if (saved) {
        const parsed = parseInt(saved, 10)
        if (Number.isFinite(parsed) && parsed >= 5 && parsed <= 50) {
          return parsed
        }
      }
    } catch {
      // ignore
    }
    return 20
  })
  const [rowsPerPageInput, setRowsPerPageInput] = useState<string>(String(rowsPerPage))

  // Invoice form state
  const [invoiceForm, setInvoiceForm] = useState<{
    supplier_id: number | null
    supplier_name: string
    customer_id: number | null
    customer_name: string
    invoiceItems: InvoiceItem[]
    notes: string
    invoice_number: string
    invoice_date: string
    payment_date: string
  }>({
    supplier_id: null,
    supplier_name: '',
    customer_id: null,
    customer_name: '',
    invoiceItems: [],
    notes: '',
    invoice_number: '',
    invoice_date: '',
    payment_date: '',
  })
  
  // Müştəri axtarışı üçün state
  const [customerSearchInput, setCustomerSearchInput] = useState('')
  const [filteredCustomersForInput, setFilteredCustomersForInput] = useState<Customer[]>([])
  
  // Tarix input-ları üçün focus state-ləri
  const [invoiceDateFocused, setInvoiceDateFocused] = useState(false)
  const [paymentDateFocused, setPaymentDateFocused] = useState(false)
  
  // Məhsullar cədvəli üçün state-lər
  const [selectedItemIndices, setSelectedItemIndices] = useState<Set<number>>(new Set())
  const [debugMode, setDebugMode] = useState(false) // Debug mode deaktiv
  const [tableCollapsed, setTableCollapsed] = useState(false) // Cədvəlin yığıb-açılan vəziyyəti
  const [itemMultiSelectMode, setItemMultiSelectMode] = useState(false)
  
  // Hər sətir üçün məhsul axtarışı state-ləri
  const [itemProductSearch, setItemProductSearch] = useState<Record<number, string>>({})
  const [itemFilteredProducts, setItemFilteredProducts] = useState<Record<number, Product[]>>({})
  const [itemProductSearchFocused, setItemProductSearchFocused] = useState<Record<number, boolean>>({})
  const [notificationMessage, setNotificationMessage] = useState('')
  const [notificationType, setNotificationType] = useState<'success' | 'error' | 'info'>('info')
  
  // Bildirim göstərmək üçün helper funksiya
  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotificationType(type)
    setNotificationMessage(message)
    setTimeout(() => setNotificationMessage(''), 3000)
  }
  const itemInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  
  // Məhsullar cədvəli column konfiqurasiyası
  const [itemColumnVisibility] = useState<Record<string, boolean>>({
    checkbox: true,
    rowNumber: true,
    product_name: true,
    code: true,
    unit: true,
    quantity: true,
    barcode: true,
    unit_price: true,
    total_price: true,
  })
  
  const [itemColumnWidths] = useState<Record<string, number>>({
    checkbox: 50,
    rowNumber: 60,
    product_name: 200,
    code: 100,
    unit: 80,
    quantity: 100,
    barcode: 120,
    unit_price: 120,
    total_price: 120,
  })
  
  const [itemColumnOrder] = useState<string[]>([
    'checkbox',
    'rowNumber',
    'product_name',
    'code',
    'unit',
    'quantity',
    'barcode',
    'unit_price',
    'total_price',
  ])

  useEffect(() => {
    loadInvoices()
    loadCustomers()
    loadProducts()
  }, [])

  // Toolbar və panel yüksəkliklərini hesabla
  useEffect(() => {
    if (toolbarRef.current) {
      setToolbarHeight(toolbarRef.current.offsetHeight)
    }
  }, [])

  useEffect(() => {
    if (searchPanelRef.current) {
      setSearchPanelHeight(searchOpen ? searchPanelRef.current.offsetHeight : 0)
    }
  }, [searchOpen])

  useEffect(() => {
    // Filter is handled in filteredInvoices calculation
  }, [searchText, invoices])

  useEffect(() => {
    if (customerSearch.trim()) {
      const term = customerSearch.toLowerCase()
      setFilteredCustomers(
        customers.filter(c => c.name?.toLowerCase().includes(term))
      )
    } else {
      setFilteredCustomers(customers)
    }
  }, [customerSearch, customers])

  useEffect(() => {
    if (productSearch.trim()) {
      const term = productSearch.toLowerCase()
      setFilteredProducts(
        products.filter(p => p.name?.toLowerCase().includes(term))
      )
    } else {
      setFilteredProducts(products)
    }
  }, [productSearch, products])

  const loadInvoices = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await ordersAPI.getAll()
      setInvoices(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Qaimələr yüklənərkən xəta baş verdi')
    } finally {
      setLoading(false)
    }
  }

  const loadCustomers = async () => {
    try {
      const data = await customersAPI.getAll()
      setCustomers(data)
      setFilteredCustomers(data)
    } catch (err: any) {
      console.error('Müştərilər yüklənərkən xəta:', err)
    }
  }

  const loadProducts = async () => {
    try {
      const data = await productsAPI.getAll()
      setProducts(data)
      setFilteredProducts(data)
    } catch (err: any) {
      console.error('Məhsullar yüklənərkən xəta:', err)
    }
  }

  const handleNewInvoice = () => {
    setSelectedInvoice(null)
    // İlk açılışda tarixləri boş saxla, placeholder göstərilsin
    setInvoiceForm({
      customer_id: null,
      customer_name: '',
      invoiceItems: [],
      notes: '',
      invoice_number: '',
      invoice_date: '',
      payment_date: '',
    })
    setCustomerSearchInput('')
    setInvoiceDateFocused(false)
    setPaymentDateFocused(false)
    setShowInvoiceModal(true)
  }

  // Toolbar handlers
  const handleAdd = () => {
    handleNewInvoice()
  }

  const handleEdit = () => {
    if (selectedIds.size === 1) {
      const invoiceId = Array.from(selectedIds)[0]
      const invoice = invoices.find(inv => inv.id === invoiceId)
      if (invoice) {
        handleEditInvoice(invoice)
      }
    }
  }

  const handleDelete = async () => {
    if (selectedIds.size > 0) {
      // Seçilmiş qaimələrdən hansıları silinmişdir yoxlayaq
      const selectedInvoices = invoices.filter(inv => selectedIds.has(inv.id))
      const deletedInvoices = selectedInvoices.filter(inv => inv.is_deleted)
      const activeInvoices = selectedInvoices.filter(inv => !inv.is_deleted)

      if (deletedInvoices.length > 0 && activeInvoices.length > 0) {
        // Həm silinmiş, həm də aktiv qaimələr var
        showNotification('Zəhmət olmasa, ya yalnız silinmiş qaimələri, ya da yalnız aktiv qaimələri seçin', 'error')
        return
      }

      if (deletedInvoices.length > 0) {
        // Silinmiş qaimələri geri qaytar
        if (confirm(`${deletedInvoices.length} silinmiş qaimə geri qaytarılsın? (Təsdiqsiz olaraq saxlanılacaq)`)) {
          try {
            await Promise.all(deletedInvoices.map(inv => ordersAPI.restore(inv.id.toString())))
            await loadInvoices()
            setSelectedIds(new Set())
            showNotification('Qaimələr uğurla geri qaytarıldı', 'success')
          } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Geri qaytarılarkən xəta baş verdi'
            showNotification(errorMessage, 'error')
            console.error('Restore error:', err)
          }
        }
      } else {
        // Aktiv qaimələri sil
        if (confirm(`${activeInvoices.length} qaimə silinsin?`)) {
          try {
            await Promise.all(activeInvoices.map(inv => ordersAPI.delete(inv.id.toString())))
            await loadInvoices()
            setSelectedIds(new Set())
          } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Silinərkən xəta baş verdi'
            showNotification(errorMessage, 'error')
            console.error('Delete error:', err)
          }
        }
      }
    }
  }

  const handleCopy = () => {
    if (selectedIds.size > 0) {
      showNotification('Kopyalama funksiyası hazırlanır...', 'info')
    }
  }

  const handleRefresh = () => {
    loadInvoices()
  }

  const handleSearch = () => {
    setSearchOpen(!searchOpen)
  }

  const handleFilter = () => {
    setFilterOpen(!filterOpen)
  }

  const handleSettings = () => {
    setSettingsModalOpen(true)
  }

  const handleActivate = async () => {
    if (selectedIds.size === 0) {
      showNotification('Qaimə seçilməyib', 'error')
      return
    }
    
    // Silinmiş qaimələri yoxla
    const selectedInvoices = invoices.filter(inv => selectedIds.has(inv.id))
    const deletedInvoices = selectedInvoices.filter(inv => inv.is_deleted)
    if (deletedInvoices.length > 0) {
      showNotification('Silinmiş qaimələri təsdiqləmək olmaz. Əvvəlcə qaimələri geri qaytarmalısınız.', 'error')
      return
    }
    
    try {
      await Promise.all(Array.from(selectedIds).map(id => ordersAPI.updateStatus(id.toString(), true)))
      await loadInvoices()
      setSelectedIds(new Set())
      showNotification('Qaimələr uğurla təsdiqləndi', 'success')
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Xəta baş verdi', 'error')
    }
  }

  const handleDeactivate = async () => {
    if (selectedIds.size === 0) {
      showNotification('Qaimə seçilməyib', 'error')
      return
    }
    try {
      await Promise.all(Array.from(selectedIds).map(id => ordersAPI.updateStatus(id.toString(), false)))
      await loadInvoices()
      setSelectedIds(new Set())
      showNotification('Qaimələr uğurla təsdiqsiz edildi', 'success')
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Xəta baş verdi', 'error')
    }
  }

  const handleMoveColumn = (columnKey: string, direction: 'up' | 'down' | 'left' | 'right') => {
    const currentIndex = columnOrder.indexOf(columnKey)
    if (currentIndex === -1) return

    const newOrder = [...columnOrder]
    if ((direction === 'up' || direction === 'left') && currentIndex > 0) {
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]]
    } else if ((direction === 'down' || direction === 'right') && currentIndex < newOrder.length - 1) {
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]]
    }
    setColumnOrder(newOrder)
  }

  // Drag & Drop funksiyaları (Mouse)
  const handleDragStart = (e: React.DragEvent, columnKey: string) => {
    if (columnKey === 'checkbox') {
      e.preventDefault()
      return // Checkbox sütununu sürüşdürmə
    }
    setDraggedColumn(columnKey)
    setIsDragging(true)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', columnKey)
    // Drag görünüşünü yaxşılaşdır
    if (e.dataTransfer.setDragImage) {
      const dragImage = document.createElement('div')
      dragImage.style.position = 'absolute'
      dragImage.style.top = '-1000px'
      dragImage.textContent = columnConfig[columnKey]?.label || columnKey
      document.body.appendChild(dragImage)
      e.dataTransfer.setDragImage(dragImage, 0, 0)
      setTimeout(() => document.body.removeChild(dragImage), 0)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (targetColumn !== 'checkbox' && draggedColumn && draggedColumn !== targetColumn) {
      const targetElement = e.currentTarget as HTMLElement
      targetElement.style.opacity = '0.5'
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const targetElement = e.currentTarget as HTMLElement
    targetElement.style.opacity = '1'
  }

  const handleDrop = (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault()
    e.stopPropagation()
    const targetElement = e.currentTarget as HTMLElement
    targetElement.style.opacity = '1'
    
    if (!draggedColumn || draggedColumn === targetColumn || targetColumn === 'checkbox') {
      setIsDragging(false)
      setDraggedColumn(null)
      return
    }

    const newOrder = [...columnOrder]
    const draggedIndex = newOrder.indexOf(draggedColumn)
    const targetIndex = newOrder.indexOf(targetColumn)

    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedColumn)

    setColumnOrder(newOrder)
    setDraggedColumn(null)
    setIsDragging(false)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDraggedColumn(null)
    // Bütün th elementlərinin opacity-sini reset et
    document.querySelectorAll('th[data-column-key]').forEach((th) => {
      (th as HTMLElement).style.opacity = '1'
    })
  }

  // Resize funksiyaları (Mouse)
  const handleResizeStart = (e: React.MouseEvent, columnKey: string) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(columnKey)
    
    const startX = e.clientX
    const startWidth = columnWidths[columnKey] || 100

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX
      const newWidth = Math.max(50, startWidth + diff) // Minimum 50px
      setColumnWidths(prev => ({ ...prev, [columnKey]: newWidth }))
    }

    const handleMouseUp = () => {
      setResizingColumn(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Touch event-ləri üçün resize
  const handleResizeTouchStart = (e: React.TouchEvent, columnKey: string) => {
    e.stopPropagation()
    setResizingColumn(columnKey)
    
    const touch = e.touches[0]
    const startX = touch.clientX
    const startWidth = columnWidths[columnKey] || 100

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      e.preventDefault() // Document level-də non-passive listener istifadə edirik
      const touch = e.touches[0]
      const diff = touch.clientX - startX
      const newWidth = Math.max(50, startWidth + diff) // Minimum 50px
      setColumnWidths(prev => ({ ...prev, [columnKey]: newWidth }))
    }

    const handleTouchEnd = () => {
      setResizingColumn(null)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)
  }

  const handleResetToDefaults = () => {
    setColumnVisibility({
      checkbox: true,
      rowNumber: true,
      id: true,
      invoice_number: true,
      supplier_name: true,
      invoice_date: true,
      total_amount: true,
      notes: true,
      is_active_status: true,
    })
    setColumnWidths({
      checkbox: 50,
      rowNumber: 60,
      id: 100,
      invoice_number: 150,
      supplier_name: 200,
      invoice_date: 120,
      total_amount: 150,
      notes: 200,
      is_active_status: 100,
    })
    setColumnOrder([
      'checkbox',
      'is_active_status',
      'rowNumber',
      'id',
      'invoice_number',
      'supplier_name',
      'invoice_date',
      'total_amount',
      'notes',
    ])
  }

  const handleEditInvoice = async (invoice: SaleInvoice) => {
    // Silinən qaimələri redaktə etməyə icazə vermə
    if (invoice.is_deleted) {
      showNotification('Silinmiş qaiməni redaktə etmək mümkün deyil', 'error')
      return
    }
    try {
      const fullInvoice = await ordersAPI.getById(invoice.id.toString())
      const items: InvoiceItem[] = (fullInvoice.sale_invoice_items || []).map((item: any) => ({
        product_id: item.product_id,
        product_name: item.products?.name || 'Naməlum məhsul',
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total_price: Number(item.total_price),
      }))

      // Qaimə tarixini formatla (saat, dəqiqə, saniyə ilə)
      let invoiceDateStr = ''
      if (fullInvoice.invoice_date) {
        const date = new Date(fullInvoice.invoice_date)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        invoiceDateStr = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
      }
      
      // Ödəniş tarixini formatla
      let paymentDateStr = ''
      if ((fullInvoice as any).payment_date) {
        const date = new Date((fullInvoice as any).payment_date)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        paymentDateStr = `${year}-${month}-${day}`
      }
      
      setSelectedInvoice(fullInvoice)
      setInvoiceForm({
        customer_id: fullInvoice.customer_id || null,
        customer_name: fullInvoice.customers?.name || '',
        invoiceItems: items,
        notes: fullInvoice.notes || '',
        invoice_number: fullInvoice.invoice_number || '',
        invoice_date: invoiceDateStr,
        payment_date: paymentDateStr,
      })
      setCustomerSearchInput(fullInvoice.customers?.name || '')
      setSelectedInvoice(fullInvoice)
      // Əgər tarix varsa, focus state-lərini true et
      setInvoiceDateFocused(!!invoiceDateStr)
      setPaymentDateFocused(!!paymentDateStr)
      setShowInvoiceModal(true)
    } catch (err: any) {
      showNotification('Qaimə yüklənərkən xəta baş verdi', 'error')
    }
  }

  const handleSaveInvoice = async () => {
    // Müştəri yoxdursa, qaimə yaradıla bilməz
    if (!invoiceForm.customer_id) {
      showNotification('Müştəri seçilməlidir', 'error')
      return
    }

    const validItems = invoiceForm.invoiceItems.filter(item => item.product_id !== null)
    if (validItems.length === 0) {
      showNotification('Ən azı bir məhsul seçilməlidir', 'error')
      return
    }

    try {
      const items = validItems.map(item => ({
        product_id: item.product_id!,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }))

      if (selectedInvoice) {
        // Mövcud qaimə - yenilə, amma vəziyyəti dəyişdirmə (mövcud vəziyyəti saxla)
        const updatedInvoice = await ordersAPI.update(selectedInvoice.id.toString(), {
          customer_id: invoiceForm.customer_id,
          items,
          notes: invoiceForm.notes || undefined,
          invoice_date: invoiceForm.invoice_date || undefined,
          payment_date: invoiceForm.payment_date || undefined,
        })
        // Vəziyyəti dəyişdirmə - mövcud vəziyyəti saxla
        if (selectedInvoice.is_active !== undefined && selectedInvoice.is_active !== null) {
          await ordersAPI.updateStatus(selectedInvoice.id.toString(), Boolean(selectedInvoice.is_active))
        }
        // Qaimə nömrəsini yenilə
        setInvoiceForm(prev => ({ ...prev, invoice_number: updatedInvoice.invoice_number || prev.invoice_number }))
        // updatedInvoice istifadə olundu, xəta yoxdur
        showNotification('Qaimə uğurla yeniləndi', 'success')
        setShowInvoiceModal(false)
      } else {
        // Yeni qaimə yaradır, birbaşa təsdiqsiz olaraq (is_active = false)
        await ordersAPI.create({
          customer_id: invoiceForm.customer_id,
          items,
          notes: invoiceForm.notes || undefined,
          invoice_date: invoiceForm.invoice_date || undefined,
          payment_date: invoiceForm.payment_date || undefined,
          is_active: false, // Birbaşa təsdiqsiz yaradırıq
        })
        showNotification('Qaimə uğurla yaradıldı (təsdiqsiz)', 'success')
        setShowInvoiceModal(false)
      }

      await loadInvoices()
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Qaimə yadda saxlanılarkən xəta baş verdi', 'error')
    }
  }

  const handleSaveAndConfirm = async () => {
    // Müştəri yoxdursa, qaimə təsdiqlənə bilməz
    if (!invoiceForm.customer_id) {
      showNotification('Müştəri seçilməlidir', 'error')
      return
    }

    const validItems = invoiceForm.invoiceItems.filter(item => item.product_id !== null)
    if (validItems.length === 0) {
      showNotification('Ən azı bir məhsul seçilməlidir', 'error')
      return
    }

    // Anbar qalığını yoxla
    const items = validItems.map(item => ({
      product_id: item.product_id!,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }))

    try {
      const stockCheckItems = validItems.map(item => ({
        product_id: item.product_id!,
        quantity: item.quantity,
      }))

      console.log('Checking warehouse stock for items:', stockCheckItems)
      const stockCheck = await ordersAPI.checkWarehouseStock(stockCheckItems)
      console.log('Stock check result:', stockCheck)

      if (stockCheck.has_insufficient_stock) {
        const insufficientItems = stockCheck.insufficient_items
        const warningMessage = insufficientItems
          .map(item => {
            if (item.available_quantity <= 0) {
              return `"${item.product_name}" - anbar qalığı yoxdur (mövcud: ${item.available_quantity}, tələb olunan: ${item.required_quantity})`
            } else {
              return `"${item.product_name}" - anbar qalığı azdır (mövcud: ${item.available_quantity}, tələb olunan: ${item.required_quantity})`
            }
          })
          .join('\n')

        const confirmMessage = `Anbar qalığı problemi:\n\n${warningMessage}\n\nQaimə təsdiqlənsə, anbar mənfiyə gedəcək. Davam etmək istəyirsiniz?`

        if (!confirm(confirmMessage)) {
          return
        }
      }
    } catch (stockErr: any) {
      console.error('Stock check error:', stockErr)
      showNotification('Anbar qalığı yoxlanılarkən xəta baş verdi: ' + (stockErr.response?.data?.message || stockErr.message), 'error')
      return
    }

    try {

      if (selectedInvoice) {
        await ordersAPI.update(selectedInvoice.id.toString(), {
          customer_id: invoiceForm.customer_id,
          items,
          notes: invoiceForm.notes || undefined,
          invoice_date: invoiceForm.invoice_date || undefined,
          payment_date: invoiceForm.payment_date || undefined,
        })
        try {
          await ordersAPI.updateStatus(selectedInvoice.id.toString(), true)
        } catch (statusErr: any) {
          // Status update xətası - anbar qalığı problemi ola bilər
          showNotification(statusErr.response?.data?.message || 'Qaimə təsdiqlənərkən xəta baş verdi', 'error')
          return
        }
        // Qaimə nömrəsini yenilə (təsdiqləndikdə nömrə yazılacaq)
        const confirmedInvoice = await ordersAPI.getById(selectedInvoice.id.toString())
        setInvoiceForm(prev => ({ ...prev, invoice_number: confirmedInvoice.invoice_number || prev.invoice_number }))
        showNotification('Qaimə uğurla yeniləndi və təsdiq edildi', 'success')
        setShowInvoiceModal(false)
      } else {
        const newInvoice = await ordersAPI.create({
          customer_id: invoiceForm.customer_id,
          items,
          notes: invoiceForm.notes || undefined,
          invoice_date: invoiceForm.invoice_date || undefined,
          payment_date: invoiceForm.payment_date || undefined,
        })
        if (newInvoice.id) {
          try {
            await ordersAPI.updateStatus(newInvoice.id.toString(), true)
          } catch (statusErr: any) {
            // Status update xətası - anbar qalığı problemi ola bilər
            showNotification(statusErr.response?.data?.message || 'Qaimə təsdiqlənərkən xəta baş verdi', 'error')
            return
          }
          // Təsdiqləndikdən sonra qaimə nömrəsini götür
          const confirmedInvoice = await ordersAPI.getById(newInvoice.id.toString())
          setInvoiceForm(prev => ({ ...prev, invoice_number: confirmedInvoice.invoice_number || '' }))
          setSelectedInvoice(confirmedInvoice)
        }
        showNotification('Qaimə uğurla yaradıldı və təsdiq edildi', 'success')
        setShowInvoiceModal(false)
      }

      await loadInvoices()
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Qaimə yadda saxlanılarkən xəta baş verdi', 'error')
    }
  }

  const handleSelectCustomer = (customer: Customer) => {
    setInvoiceForm(prev => ({
      ...prev,
      customer_id: customer.id,
      customer_name: customer.name || '',
    }))
    setShowCustomerModal(false)
    setCustomerSearch('')
  }

  const handleAddProduct = (product: Product) => {
    const newItem: InvoiceItem = {
      product_id: product.id,
      product_name: product.name || '',
      quantity: 1,
      unit_price: product.sale_price || 0,
      total_price: product.sale_price || 0,
    }
    setInvoiceForm(prev => ({
      ...prev,
      invoiceItems: [...prev.invoiceItems, newItem],
    }))
    setShowProductModal(false)
    setProductSearch('')
  }
  
  // Boş sətir əlavə et
  const handleAddEmptyRow = () => {
    const newItem: InvoiceItem = {
      product_id: null,
      product_name: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
    }
    const newIndex = invoiceForm.invoiceItems.length
    setInvoiceForm(prev => ({
      ...prev,
      invoiceItems: [...prev.invoiceItems, newItem],
    }))
    // Yeni sətir üçün axtarış state-lərini başlat
    setItemProductSearch(prev => ({ ...prev, [newIndex]: '' }))
    setItemFilteredProducts(prev => ({ ...prev, [newIndex]: [] }))
    setItemProductSearchFocused(prev => ({ ...prev, [newIndex]: false }))
  }
  
  // Sətirdə məhsul axtarışı
  const handleItemProductSearch = (index: number, searchText: string) => {
    setItemProductSearch(prev => ({ ...prev, [index]: searchText }))
    if (searchText.trim()) {
      const term = searchText.toLowerCase()
      const filtered = products.filter(p => 
        p.name?.toLowerCase().includes(term) ||
        p.code?.toLowerCase().includes(term) ||
        p.article?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term)
      )
      setItemFilteredProducts(prev => ({ ...prev, [index]: filtered }))
    } else {
      setItemFilteredProducts(prev => ({ ...prev, [index]: [] }))
    }
  }
  
  // Sətirdə məhsul seç
  const handleSelectItemProduct = (index: number, product: Product) => {
    setInvoiceForm(prev => {
      const newItems = [...prev.invoiceItems]
      const currentQuantity = newItems[index].quantity || 1
      const currentUnitPrice = product.sale_price || 0
      
      // Eyni məhsulun başqa sətirdə olub-olmadığını yoxla
      const existingItemIndex = newItems.findIndex(
        (item, idx) => idx !== index && item.product_id === product.id
      )
      
      if (existingItemIndex !== -1) {
        // Eyni məhsul tapıldı - birləşdir
        const existingItem = newItems[existingItemIndex]
        const mergedQuantity = (existingItem.quantity || 0) + currentQuantity
        const mergedTotalPrice = mergedQuantity * currentUnitPrice
        
        // Mövcud item-i yenilə
        newItems[existingItemIndex] = {
          ...existingItem,
          quantity: mergedQuantity,
          total_price: mergedTotalPrice,
        }
        
        // İndiki sətiri sil
        newItems.splice(index, 1)
        
        // Bildirim göstər
        showNotification(`Eyni məhsul əlavə edildiyi üçün miqdarlar toplandı: ${product.name} (${mergedQuantity} ədəd)`, 'success')
        
        // Silinən sətir üçün state-ləri təmizlə
        setItemProductSearch(prev => {
          const updated: Record<number, string> = {}
          Object.keys(prev).forEach(key => {
            const idx = parseInt(key)
            if (idx < index) {
              updated[idx] = prev[idx]
            } else if (idx > index) {
              updated[idx - 1] = prev[idx]
            }
            // idx === index olanı atla
          })
          return updated
        })
        
        setItemFilteredProducts(prev => {
          const updated: Record<number, Product[]> = {}
          Object.keys(prev).forEach(key => {
            const idx = parseInt(key)
            if (idx < index) {
              updated[idx] = prev[idx]
            } else if (idx > index) {
              updated[idx - 1] = prev[idx]
            }
          })
          return updated
        })
        
        setItemProductSearchFocused(prev => {
          const updated: Record<number, boolean> = {}
          Object.keys(prev).forEach(key => {
            const idx = parseInt(key)
            if (idx < index) {
              updated[idx] = prev[idx]
            } else if (idx > index) {
              updated[idx - 1] = prev[idx]
            }
          })
          return updated
        })
        
        // Seçilmiş indeksləri yenilə
        setSelectedItemIndices(prev => {
          const newSelected = new Set<number>()
          prev.forEach(selectedIdx => {
            if (selectedIdx < index) {
              newSelected.add(selectedIdx)
            } else if (selectedIdx > index) {
              newSelected.add(selectedIdx - 1)
            }
            // selectedIdx === index olanı atla (silinən sətir)
          })
          return newSelected
        })
      } else {
        // Eyni məhsul yoxdur - normal əlavə et
        newItems[index] = {
          ...newItems[index],
          product_id: product.id,
          product_name: product.name || '',
          unit_price: currentUnitPrice,
          total_price: currentQuantity * currentUnitPrice,
        }
        setItemProductSearch(prev => ({ ...prev, [index]: product.name || '' }))
        setItemFilteredProducts(prev => ({ ...prev, [index]: [] }))
        setItemProductSearchFocused(prev => ({ ...prev, [index]: false }))
      }
      
      return { ...prev, invoiceItems: newItems }
    })
  }

  const handleUpdateItem = (index: number, field: keyof InvoiceItem, value: number | string) => {
    setInvoiceForm(prev => {
      const newItems = [...prev.invoiceItems]
      const item = { ...newItems[index] }
      
      if (field === 'quantity' || field === 'unit_price' || field === 'total_price') {
        item[field] = value as number
      } else if (field === 'product_name') {
        item[field] = value as string
      } else if (field === 'product_id') {
        item[field] = value as number | null
      } else if (field === 'product_code' || field === 'product_unit' || field === 'product_barcode' || field === 'product_article') {
        item[field] = value as string | undefined
      }

      if (field === 'quantity' || field === 'unit_price') {
        item.total_price = item.quantity * item.unit_price
      }

      newItems[index] = item
      return { ...prev, invoiceItems: newItems }
    })
  }

  // Məhsul idarəetmə funksiyaları
  const handleDeleteItems = () => {
    if (selectedItemIndices.size === 0) return
    const sortedIndices = Array.from(selectedItemIndices).sort((a, b) => b - a)
    setInvoiceForm(prev => {
      const newItems = [...prev.invoiceItems]
      sortedIndices.forEach(idx => {
        newItems.splice(idx, 1)
      })
      return { ...prev, invoiceItems: newItems }
    })
    setSelectedItemIndices(new Set())
  }
  
  const handleCopyItems = () => {
    if (selectedItemIndices.size === 0) return
    const sortedIndices = Array.from(selectedItemIndices).sort((a, b) => a - b)
    setInvoiceForm(prev => {
      const newItems = [...prev.invoiceItems]
      const itemsToCopy = sortedIndices.map(idx => ({ ...prev.invoiceItems[idx] }))
      // Kopyalanan elementləri sona əlavə et
      return { ...prev, invoiceItems: [...newItems, ...itemsToCopy] }
    })
  }
  
  const handleMoveItemUp = () => {
    if (selectedItemIndices.size === 0) return
    const sortedIndices = Array.from(selectedItemIndices).sort((a, b) => a - b)
    if (sortedIndices[0] === 0) return // Artıq ən yuxarıda
    
    setInvoiceForm(prev => {
      const newItems = [...prev.invoiceItems]
      sortedIndices.forEach(idx => {
        if (idx > 0) {
          [newItems[idx - 1], newItems[idx]] = [newItems[idx], newItems[idx - 1]]
        }
      })
      return { ...prev, invoiceItems: newItems }
    })
    
    // Seçimləri yenilə
    const newSelected = new Set<number>()
    sortedIndices.forEach(idx => {
      if (idx > 0) {
        newSelected.add(idx - 1)
      } else {
        newSelected.add(idx)
      }
    })
    setSelectedItemIndices(newSelected)
  }
  
  const handleMoveItemDown = () => {
    if (selectedItemIndices.size === 0) return
    const sortedIndices = Array.from(selectedItemIndices).sort((a, b) => b - a)
    
    setInvoiceForm(prev => {
      if (sortedIndices[0] === prev.invoiceItems.length - 1) return prev // Artıq ən aşağıda
      
      const newItems = [...prev.invoiceItems]
      sortedIndices.forEach(idx => {
        if (idx < prev.invoiceItems.length - 1) {
          [newItems[idx], newItems[idx + 1]] = [newItems[idx + 1], newItems[idx]]
        }
      })
      
      // Seçimləri yenilə
      const newSelected = new Set<number>()
      sortedIndices.forEach(idx => {
        if (idx < prev.invoiceItems.length - 1) {
          newSelected.add(idx + 1)
        } else {
          newSelected.add(idx)
        }
      })
      setSelectedItemIndices(newSelected)
      
      return { ...prev, invoiceItems: newItems }
    })
  }

  const handleToggleStatus = async (invoice: SaleInvoice) => {
    // Silinmiş qaimələrin statusunu dəyişmək olmaz
    if (invoice.is_deleted) {
      showNotification('Silinmiş qaiməni təsdiqləmək və ya təsdiqsiz etmək olmaz. Əvvəlcə qaiməni geri qaytarmalısınız.', 'error')
      return
    }

    // Əgər təsdiqlənirsə, anbar qalığını yoxla
    if (!invoice.is_active) {
      try {
        const fullInvoice = await ordersAPI.getById(invoice.id.toString())
        const items = (fullInvoice.sale_invoice_items || []).map((item: any) => ({
          product_id: item.product_id!,
          quantity: Number(item.quantity),
        }))

        if (items.length > 0) {
          const stockCheck = await ordersAPI.checkWarehouseStock(items)

          if (stockCheck.has_insufficient_stock) {
            const insufficientItems = stockCheck.insufficient_items
            const warningMessage = insufficientItems
              .map(item => {
                if (item.available_quantity <= 0) {
                  return `"${item.product_name}" - anbar qalığı yoxdur (mövcud: ${item.available_quantity}, tələb olunan: ${item.required_quantity})`
                } else {
                  return `"${item.product_name}" - anbar qalığı azdır (mövcud: ${item.available_quantity}, tələb olunan: ${item.required_quantity})`
                }
              })
              .join('\n')

            const confirmMessage = `Anbar qalığı problemi:\n\n${warningMessage}\n\nQaimə təsdiqlənsə, anbar mənfiyə gedəcək. Davam etmək istəyirsiniz?`

            if (!confirm(confirmMessage)) {
              return
            }
          }
        }
      } catch (err: any) {
        console.error('Stock check error:', err)
        showNotification('Anbar qalığı yoxlanılarkən xəta baş verdi', 'error')
        return
      }
    }
    
    try {
      await ordersAPI.updateStatus(invoice.id.toString(), !invoice.is_active)
      await loadInvoices()
      showNotification(invoice.is_active ? 'Qaimə təsdiqsiz edildi' : 'Qaimə təsdiqləndi', 'success')
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Xəta baş verdi', 'error')
    }
  }

  // Column configuration
  const columnConfig: Record<string, { label: string; align?: 'left' | 'right' | 'center' }> = {
    checkbox: { label: '', align: 'center' },
    rowNumber: { label: '№', align: 'center' },
    id: { label: 'ID', align: 'center' },
    invoice_number: { label: 'Faktura №', align: 'left' },
    customer_name: { label: 'Müştəri', align: 'left' },
    invoice_date: { label: 'Tarix', align: 'left' },
    total_amount: { label: 'Ümumi məbləğ', align: 'right' },
    notes: { label: 'Qeydlər', align: 'left' },
    is_active_status: { label: 'Status', align: 'center' },
  }

  // Sort handler
  const handleSort = (columnKey: string) => {
    if (sortConfig?.key === columnKey) {
      if (sortConfig.direction === 'asc') {
        setSortConfig({ key: columnKey, direction: 'desc' })
      } else {
        setSortConfig(null)
      }
    } else {
      setSortConfig({ key: columnKey, direction: 'asc' })
    }
  }

  // Filter and sort invoices
  let filteredInvoices = searchText.trim()
    ? invoices.filter(inv => {
        const term = searchText.toLowerCase()
        return (
          formatSaleInvoiceNumber(inv.invoice_number)?.toLowerCase().includes(term) ||
          inv.customers?.name?.toLowerCase().includes(term) ||
          inv.notes?.toLowerCase().includes(term)
        )
      })
    : invoices

  // Apply sorting
  if (sortConfig) {
    filteredInvoices = [...filteredInvoices].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortConfig.key) {
        case 'id':
          aValue = a.id
          bValue = b.id
          break
        case 'invoice_number':
          aValue = formatSaleInvoiceNumber(a.invoice_number)
          bValue = formatSaleInvoiceNumber(b.invoice_number)
          break
        case 'customer_name':
          aValue = a.customers?.name || ''
          bValue = b.customers?.name || ''
          break
        case 'invoice_date':
          aValue = a.invoice_date ? new Date(a.invoice_date).getTime() : 0
          bValue = b.invoice_date ? new Date(b.invoice_date).getTime() : 0
          break
        case 'total_amount':
          aValue = Number(a.total_amount) || 0
          bValue = Number(b.total_amount) || 0
          break
        case 'notes':
          aValue = a.notes || ''
          bValue = b.notes || ''
          break
        case 'is_active_status':
          aValue = a.is_active ? 1 : 0
          bValue = b.is_active ? 1 : 0
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }

  // Table body max height
  const DEFAULT_ROW_HEIGHT = 44
  const tableBodyMaxHeightPx = DEFAULT_ROW_HEIGHT * rowsPerPage

  // rowsPerPage dəyərini localStorage-a yaz
  useEffect(() => {
    localStorage.setItem('saleInvoiceTableRowsPerPage', String(rowsPerPage))
    setRowsPerPageInput(String(rowsPerPage))
  }, [rowsPerPage])

  // Sütun sırasını localStorage-a yaz
  useEffect(() => {
    localStorage.setItem('saleInvoiceTableColumnOrder', JSON.stringify(columnOrder))
  }, [columnOrder])

  useEffect(() => {
    localStorage.setItem('saleInvoiceTableColumnWidths', JSON.stringify(columnWidths))
  }, [columnWidths])

  // Touch event-ləri üçün non-passive listener-lar əlavə et
  useEffect(() => {
    const cleanupFunctions: Array<() => void> = []
    const elements = Array.from(thRefs.current.entries())
    
    // Touch drag state-i üçün ref (closure problemi üçün)
    let touchDragState: {
      startX: number
      startColumn: string
      isDragging: boolean
      draggedColumn: string | null
    } | null = null
    
    elements.forEach(([columnKey, thElement]) => {
      if (!thElement || columnKey === 'checkbox') return
      
      const handleTouchStartNative = (e: TouchEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const touch = e.touches[0]
        touchDragState = {
          startX: touch.clientX,
          startColumn: columnKey,
          isDragging: false,
          draggedColumn: null
        }
        setIsDragging(false)
        setDraggedColumn(null)
      }
      
      const handleTouchMoveNative = (e: TouchEvent) => {
        if (!touchDragState) return
        e.preventDefault()
        e.stopPropagation()
        
        const touch = e.touches[0]
        const diff = Math.abs(touch.clientX - touchDragState.startX)
        
        // Əgər 10px-dən çox hərəkət edibsə, drag başlayır
        if (diff > 10 && !touchDragState.isDragging) {
          touchDragState.isDragging = true
          touchDragState.draggedColumn = touchDragState.startColumn
          setIsDragging(true)
          setDraggedColumn(touchDragState.startColumn)
        }
        
        // Hərəkət edən column-u tap
        if (touchDragState.isDragging) {
          const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY)
          if (elementBelow) {
            const targetTh = elementBelow.closest('th[data-column-key]') as HTMLElement
            if (targetTh) {
              const targetColumnKey = targetTh.dataset.columnKey
              if (targetColumnKey && targetColumnKey !== touchDragState.draggedColumn && targetColumnKey !== 'checkbox') {
                // Visual feedback üçün dragged column-u göstər
                setDraggedColumn(touchDragState.draggedColumn)
              }
            }
          }
        }
      }
      
      const handleTouchEndNative = (e: TouchEvent) => {
        if (!touchDragState) return
        e.preventDefault()
        e.stopPropagation()
        
        if (touchDragState.isDragging && touchDragState.draggedColumn) {
          // Final column-u tap
          const touch = e.changedTouches[0]
          const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY)
          
          if (elementBelow) {
            const targetTh = elementBelow.closest('th[data-column-key]') as HTMLElement
            if (targetTh) {
              const targetColumnKey = targetTh.dataset.columnKey
              
              if (targetColumnKey && 
                  targetColumnKey !== touchDragState.draggedColumn && 
                  targetColumnKey !== 'checkbox') {
                // Sütunları yerdəyişdir
                setColumnOrder((prevOrder) => {
                  const newOrder = [...prevOrder]
                  const draggedIndex = newOrder.indexOf(touchDragState!.draggedColumn!)
                  const targetIndex = newOrder.indexOf(targetColumnKey)
                  
                  if (draggedIndex !== -1 && targetIndex !== -1) {
                    newOrder.splice(draggedIndex, 1)
                    newOrder.splice(targetIndex, 0, touchDragState!.draggedColumn!)
                    return newOrder
                  }
                  return prevOrder
                })
              }
            }
          }
        }
        
        // Reset state
        touchDragState = null
        setIsDragging(false)
        setDraggedColumn(null)
      }
      
      thElement.addEventListener('touchstart', handleTouchStartNative, { passive: false })
      thElement.addEventListener('touchmove', handleTouchMoveNative, { passive: false })
      thElement.addEventListener('touchend', handleTouchEndNative, { passive: false })
      
      cleanupFunctions.push(() => {
        thElement.removeEventListener('touchstart', handleTouchStartNative)
        thElement.removeEventListener('touchmove', handleTouchMoveNative)
        thElement.removeEventListener('touchend', handleTouchEndNative)
      })
    })
    
    return () => {
      cleanupFunctions.forEach(cleanup => cleanup())
      touchDragState = null
    }
  }, [columnOrder.length])

  const totalAmount = invoiceForm.invoiceItems.reduce((sum, item) => sum + item.total_price, 0)
  
  // Məhsul məlumatlarını tapmaq üçün helper funksiya
  const getProductInfo = (productId: number | null) => {
    if (!productId) return null
    return products.find(p => p.id === productId)
  }
  
  // Məhsullar cədvəli column konfiqurasiyası
  const itemColumnConfig: Record<string, { label: string; align?: 'left' | 'right' | 'center' }> = {
    checkbox: { label: '', align: 'center' },
    rowNumber: { label: '№', align: 'center' },
    product_name: { label: 'Məhsul', align: 'left' },
    code: { label: 'Kod', align: 'left' },
    unit: { label: 'Vahid', align: 'center' },
    quantity: { label: 'Miqdar', align: 'right' },
    barcode: { label: 'Barkod', align: 'left' },
    unit_price: { label: 'Vahid qiymət', align: 'right' },
    total_price: { label: 'Cəm', align: 'right' },
  }

  // Layout sabitləri
  const NAVBAR_HEIGHT = 56
  const NAVBAR_TOOLBAR_GAP = 20
  const TOOLBAR_TABLE_GAP = 0

  const toolbarTop = NAVBAR_HEIGHT + NAVBAR_TOOLBAR_GAP
  const contentPaddingTop =
    toolbarTop +
    toolbarHeight +
    searchPanelHeight +
    TOOLBAR_TABLE_GAP

  return (
    <Layout>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%', 
        marginTop: `-${NAVBAR_HEIGHT}px`, 
        paddingTop: `${contentPaddingTop}px`,
      }}>
        {/* Toolbar */}
        <div
          ref={toolbarRef}
          style={{
            background: '#f5f7fc',
            borderBottom: '1px solid #d0d7e2',
            padding: '0.5rem 0.75rem',
            display: 'flex',
            gap: '0.35rem',
            alignItems: 'center',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            flexShrink: 0,
            position: 'fixed',
            top: `${toolbarTop}px`,
            left: 0,
            right: 0,
            zIndex: 999,
            scrollbarWidth: 'thin',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
            boxSizing: 'border-box',
          }}
        >
          <button
            onClick={handleAdd}
            style={{
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '1.25rem',
              cursor: 'pointer',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Əlavə et"
          >
            ➕
          </button>
          <button
            onClick={handleEdit}
            disabled={selectedIds.size !== 1}
            style={{
              background: selectedIds.size === 1 ? '#ff9800' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '1.25rem',
              cursor: selectedIds.size === 1 ? 'pointer' : 'not-allowed',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Redaktə et"
          >
            ✏️
          </button>
          {(() => {
            const selectedInvoices = invoices.filter(inv => selectedIds.has(inv.id))
            const allDeleted = selectedInvoices.length > 0 && selectedInvoices.every(inv => inv.is_deleted)
            const allActive = selectedInvoices.length > 0 && selectedInvoices.every(inv => !inv.is_deleted)
            const isRestore = allDeleted
            const isDelete = allActive
            
            return (
              <button
                onClick={handleDelete}
                disabled={selectedIds.size === 0 || (!isRestore && !isDelete)}
                style={{
                  background: selectedIds.size > 0 && (isRestore || isDelete) 
                    ? (isRestore ? '#4caf50' : '#d32f2f') 
                    : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '1.25rem',
                  cursor: selectedIds.size > 0 && (isRestore || isDelete) ? 'pointer' : 'not-allowed',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title={isRestore ? 'Geri qaytar' : 'Sil'}
              >
                {isRestore ? '↩️' : '🗑️'}
              </button>
            )
          })()}
          <button
            onClick={handleCopy}
            disabled={selectedIds.size === 0}
            style={{
              background: selectedIds.size > 0 ? '#1976d2' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '1.25rem',
              cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Kopyala"
          >
            📋
          </button>
          <button
            onClick={handleRefresh}
            style={{
              background: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '1.25rem',
              cursor: 'pointer',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Yenilə"
          >
            🔄
          </button>
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={handleActivate}
                style={{
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Aktiv et"
              >
                <span style={{ position: 'relative', display: 'inline-block', fontSize: '1.2rem' }}>
                  📄
                  <span style={{ 
                    position: 'absolute', 
                    top: '-2px', 
                    right: '-2px', 
                    color: '#28a745', 
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    width: '14px',
                    height: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: '1'
                  }}>✓</span>
                </span>
              </button>
              <button
                onClick={handleDeactivate}
                style={{
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Deaktiv et"
              >
                <span style={{ fontSize: '1.2rem' }}>📄</span>
              </button>
            </>
          )}
          {multiSelectMode && (
            <button
              onClick={() => {
                setMultiSelectMode(false)
                setSelectedIds(new Set())
              }}
              style={{
                background: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '1.25rem',
                cursor: 'pointer',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Çoxlu seçim rejimini deaktiv et"
            >
              ✖️
            </button>
          )}
          
          <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 0.25rem' }} />
          
          <button
            onClick={handleSearch}
            style={{
              background: searchOpen ? '#1976d2' : '#757575',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '1.25rem',
              cursor: 'pointer',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Axtarış"
          >
            🔍
          </button>
          <button
            onClick={handleFilter}
            style={{
              background: filterOpen ? '#1976d2' : '#757575',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '1.25rem',
              cursor: 'pointer',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Filtr"
          >
            🔽
          </button>
          <button
            onClick={handleSettings}
            style={{
              background: settingsOpen ? '#1976d2' : '#757575',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              fontSize: '1.25rem',
              cursor: 'pointer',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Ayarlar"
          >
            ⚙️
          </button>
        </div>

        {/* Axtarış paneli */}
        {searchOpen && (
          <div
            ref={searchPanelRef}
            style={{
              background: '#f5f5f5',
              padding: '0.35rem 0.75rem',
              borderBottom: '1px solid #e0e0e0',
              flexShrink: 0,
              position: 'fixed',
              top: `${toolbarTop + toolbarHeight}px`,
              left: 0,
              right: 0,
              zIndex: 998,
            }}
          >
            <input
              type="text"
              placeholder="Axtarış..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.6rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                minHeight: '44px',
              }}
            />
          </div>
        )}

        {/* Content */}
        <div style={{ 
          flex: 1, 
          overflow: 'hidden', 
          background: 'white',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Error */}
          {error && (
            <div style={{ padding: '0.75rem', background: '#fee', color: '#c33', borderRadius: '8px', margin: '1rem' }}>
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>Yüklənir...</p>
            </div>
          )}

          {/* Table */}
          {!loading && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {filteredInvoices.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  Qaimə tapılmadı
                </div>
              ) : (
                <div
                  ref={tableBodyScrollRef}
                  style={{
                    flex: 1,
                    overflowX: 'auto',
                    overflowY: 'auto',
                    maxHeight: `${tableBodyMaxHeightPx}px`,
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain',
                  }}
                >
                  <table
                    style={{
                      width: 'max-content',
                      minWidth: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.875rem',
                      background: 'white',
                    }}
                  >
                    <colgroup>
                      {columnOrder.map((columnKey) => {
                        if (!columnVisibility[columnKey]) return null
                        const width = columnWidths[columnKey] || 100
                        return (
                          <col
                            key={columnKey}
                            style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                          />
                        )
                      })}
                    </colgroup>
                    <thead>
                      <tr style={{ background: '#f5f5f5' }}>
                        {columnOrder.map((columnKey) => {
                          const config = columnConfig[columnKey]
                          if (!config || !columnVisibility[columnKey]) return null

                          const isCheckbox = columnKey === 'checkbox'
                          const width = columnWidths[columnKey] || 100
                          const isSorted = sortConfig?.key === columnKey
                          const sortIcon = isSorted ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ''

                          return (
                            <th
                              key={columnKey}
                              ref={(el) => {
                                if (el) {
                                  thRefs.current.set(columnKey, el)
                                } else {
                                  thRefs.current.delete(columnKey)
                                }
                              }}
                              data-column-key={columnKey}
                              draggable={!isCheckbox}
                              onDragStart={(e) => handleDragStart(e, columnKey)}
                              onDragOver={handleDragOver}
                              onDragEnter={(e) => handleDragEnter(e, columnKey)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, columnKey)}
                              onDragEnd={handleDragEnd}
                              onClick={() => !isCheckbox && !isDragging && handleSort(columnKey)}
                              style={{
                                padding: isCheckbox ? '0.75rem 0.5rem' : '0.75rem',
                                textAlign: config.align || 'left',
                                borderBottom: '2px solid #ddd',
                                borderRight: '1px solid #e0e0e0',
                                width: `${width}px`,
                                minWidth: `${width}px`,
                                maxWidth: `${width}px`,
                                fontWeight: 'bold',
                                fontSize: '0.85rem',
                                color: '#333',
                                whiteSpace: 'nowrap',
                                overflow: isCheckbox ? 'visible' : 'hidden',
                                textOverflow: isCheckbox ? 'clip' : 'ellipsis',
                                cursor: isCheckbox ? 'default' : 'pointer',
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                MozUserSelect: 'none',
                                msUserSelect: 'none',
                                position: 'sticky',
                                top: 0,
                                zIndex: isCheckbox ? 11 : 10,
                                background: draggedColumn === columnKey ? '#e3f2fd' : '#f5f5f5',
                                transition: 'background 0.2s',
                              }}
                            >
                              {isCheckbox ? (
                                <input
                                  type="checkbox"
                                  checked={selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0}
                                  onChange={() => {
                                    if (selectedIds.size === filteredInvoices.length) {
                                      const newSelected = new Set(selectedIds)
                                      filteredInvoices.forEach(inv => newSelected.delete(inv.id))
                                      setSelectedIds(newSelected)
                                    } else {
                                      const newSelected = new Set(selectedIds)
                                      filteredInvoices.forEach(inv => newSelected.add(inv.id))
                                      setSelectedIds(newSelected)
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    cursor: 'pointer',
                                  }}
                                />
                              ) : (
                                <>
                                  {config.label}
                                  {sortIcon}
                                  {/* Resize handle */}
                                  <div
                                    onMouseDown={(e) => handleResizeStart(e, columnKey)}
                                    onTouchStart={(e) => handleResizeTouchStart(e, columnKey)}
                                    style={{
                                      position: 'absolute',
                                      right: 0,
                                      top: 0,
                                      bottom: 0,
                                      width: '8px', // Touch üçün daha geniş
                                      cursor: 'col-resize',
                                      backgroundColor: resizingColumn === columnKey ? '#1976d2' : 'transparent',
                                      touchAction: 'none',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (resizingColumn !== columnKey) {
                                        e.currentTarget.style.backgroundColor = '#e0e0e0'
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (resizingColumn !== columnKey) {
                                        e.currentTarget.style.backgroundColor = 'transparent'
                                      }
                                    }}
                                  />
                                </>
                              )}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((invoice, index) => {
                        const isSelected = selectedIds.has(invoice.id)
                        return (
                          <tr
                            key={invoice.id}
                            onClick={() => {
                              if (multiSelectMode) {
                                // Çoxlu seçim rejimində: seçimi əlavə et/çıxar
                                const newSelected = new Set(selectedIds)
                                if (isSelected) {
                                  newSelected.delete(invoice.id)
                                } else {
                                  newSelected.add(invoice.id)
                                }
                                setSelectedIds(newSelected)
                              } else {
                                // Normal rejimdə: yalnız bu sətir seçilsin
                                setSelectedIds(new Set([invoice.id]))
                              }
                            }}
                            onDoubleClick={() => {
                              if (!invoice.is_deleted) {
                                handleEditInvoice(invoice)
                              } else {
                                showNotification('Silinmiş qaiməni redaktə etmək mümkün deyil', 'error')
                              }
                            }}
                            style={{
                              background: invoice.is_deleted 
                                ? '#ffebee' // Açıq qırmızı rəng silinən qaimələr üçün
                                : isSelected 
                                  ? '#e3f2fd' 
                                  : 'white',
                              cursor: 'pointer',
                              borderBottom: '1px solid #eee',
                              transition: 'background 0.2s',
                              opacity: invoice.is_deleted ? 0.7 : 1, // Silinən qaimələr bir az solğun görünsün
                            }}
                          >
                            {columnOrder.map((columnKey) => {
                              if (!columnVisibility[columnKey]) return null
                              const config = columnConfig[columnKey]
                              const isCheckbox = columnKey === 'checkbox'
                              const isRowNumber = columnKey === 'rowNumber'
                              const width = columnWidths[columnKey] || 100

                              let cellContent: React.ReactNode = ''
                              const cellStyle: React.CSSProperties = {
                                padding: isCheckbox ? '0.75rem 0.5rem' : '0.75rem',
                                textAlign: config.align || 'left',
                                borderRight: '1px solid #e0e0e0',
                                width: `${width}px`,
                                minWidth: `${width}px`,
                                maxWidth: `${width}px`,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                background: isCheckbox ? (isSelected ? '#e3f2fd' : '#f5f5f5') : 'transparent',
                              }

                              if (isCheckbox) {
                                cellContent = (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      // Checkbox-a basanda çoxlu seçim rejimini aktiv et
                                      setMultiSelectMode(true)
                                      const newSelected = new Set(selectedIds)
                                      if (e.target.checked) {
                                        newSelected.add(invoice.id)
                                      } else {
                                        newSelected.delete(invoice.id)
                                      }
                                      setSelectedIds(newSelected)
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                    }}
                                    onMouseDown={(e) => {
                                      e.stopPropagation()
                                    }}
                                    style={{
                                      width: '20px',
                                      height: '20px',
                                      cursor: 'pointer',
                                    }}
                                  />
                                )
                              } else if (isRowNumber) {
                                cellContent = index + 1
                              } else if (columnKey === 'id') {
                                cellStyle.color = '#666'
                                cellStyle.fontFamily = 'monospace'
                                cellContent = invoice.id != null ? `A${invoice.id.toString().padStart(8, '0')}` : '-'
                              } else if (columnKey === 'invoice_number') {
                                cellContent = formatSaleInvoiceNumber(invoice.invoice_number)
                              } else if (columnKey === 'customer_name') {
                                cellStyle.fontWeight = isSelected ? 'bold' : 'normal'
                                cellContent = invoice.customers?.name || '-'
                              } else if (columnKey === 'invoice_date') {
                                cellStyle.color = '#666'
                                cellContent = invoice.invoice_date
                                  ? new Date(invoice.invoice_date).toLocaleDateString('az-AZ')
                                  : '-'
                              } else if (columnKey === 'total_amount') {
                                cellStyle.textAlign = 'right'
                                cellStyle.fontWeight = 'bold'
                                cellStyle.color = '#28a745'
                                cellContent = invoice.total_amount
                                  ? `${Number(invoice.total_amount).toFixed(2)} ₼`
                                  : '0.00 ₼'
                              } else if (columnKey === 'notes') {
                                cellStyle.color = '#666'
                                cellStyle.fontStyle = 'italic'
                                cellContent = invoice.notes || '-'
                              } else if (columnKey === 'is_active_status') {
                                const isDeleted = invoice.is_deleted
                                cellContent = (
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (!isDeleted) {
                                        handleToggleStatus(invoice)
                                      }
                                    }}
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      background: invoice.is_active ? '#28a745' : '#dc3545',
                                      color: 'white',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      cursor: isDeleted ? 'not-allowed' : 'pointer',
                                      display: 'inline-block',
                                      opacity: isDeleted ? 0.5 : 1,
                                    }}
                                    title={isDeleted ? 'Silinmiş qaiməni təsdiqləmək olmaz' : (invoice.is_active ? 'Təsdiqsiz et' : 'Təsdiqlə')}
                                  >
                                    {invoice.is_active ? '✓' : '✗'}
                                  </span>
                                )
                              }

                              return (
                                <td 
                                  key={columnKey} 
                                  style={cellStyle}
                                  onClick={isCheckbox ? (e) => e.stopPropagation() : undefined}
                                  onMouseDown={isCheckbox ? (e) => e.stopPropagation() : undefined}
                                >
                                  {cellContent}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        {columnOrder.map((columnKey) => {
                          if (!columnVisibility[columnKey]) return null
                          const config = columnConfig[columnKey]
                          const width = columnWidths[columnKey] || 100

                          const cellStyle: React.CSSProperties = {
                            padding: '0.5rem',
                            borderTop: '1px solid #e0e0e0',
                            borderRight: columnKey !== 'total_amount' ? '1px solid #e0e0e0' : 'none',
                            textAlign: config?.align || 'left',
                            minWidth: width,
                            maxWidth: width,
                            fontSize: '0.85rem',
                            background: '#f5f5f5',
                            fontWeight: 'bold',
                            position: 'sticky',
                            bottom: 0,
                            zIndex: 8,
                          }

                          let content: React.ReactNode = ''

                          if (columnKey === 'total_amount') {
                            cellStyle.textAlign = 'right'
                            const total = filteredInvoices
                              .filter(inv => selectedIds.has(inv.id))
                              .reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0)
                            content = `${total.toFixed(2)} ₼`
                            cellStyle.color = '#28a745'
                          }

                          return (
                            <td key={`footer-${columnKey}`} style={cellStyle}>
                              {content}
                            </td>
                          )
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notification */}
        {notificationMessage && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: notificationType === 'success' ? '#4caf50' : notificationType === 'error' ? '#d32f2f' : '#1976d2',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              zIndex: 10001,
              fontSize: '0.9rem',
              maxWidth: '90%',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>
              {notificationType === 'success' ? '✅' : notificationType === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span>{notificationMessage}</span>
          </div>
        )}

        {/* Invoice Modal */}
        <InvoiceModal
          show={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          selectedInvoice={selectedInvoice}
          invoiceForm={invoiceForm}
          setInvoiceForm={setInvoiceForm}
          customers={customers}
          customerSearchInput={customerSearchInput}
          setCustomerSearchInput={setCustomerSearchInput}
          filteredCustomersForInput={filteredCustomersForInput}
          setFilteredCustomersForInput={setFilteredCustomersForInput}
          invoiceDateFocused={invoiceDateFocused}
          setInvoiceDateFocused={setInvoiceDateFocused}
          paymentDateFocused={paymentDateFocused}
          setPaymentDateFocused={setPaymentDateFocused}
          setShowCustomerModal={setShowCustomerModal}
          handleSaveInvoice={handleSaveInvoice}
          handleSaveAndConfirm={handleSaveAndConfirm}
          handleAddEmptyRow={handleAddEmptyRow}
          handleDeleteItems={handleDeleteItems}
          handleCopyItems={handleCopyItems}
          handleMoveItemUp={handleMoveItemUp}
          handleMoveItemDown={handleMoveItemDown}
          handleItemProductSearch={handleItemProductSearch}
          handleSelectItemProduct={handleSelectItemProduct}
          handleUpdateItem={handleUpdateItem}
          selectedItemIndices={selectedItemIndices}
          setSelectedItemIndices={setSelectedItemIndices}
          itemMultiSelectMode={itemMultiSelectMode}
          setItemMultiSelectMode={setItemMultiSelectMode}
          itemProductSearch={itemProductSearch}
          setItemProductSearch={setItemProductSearch}
          itemFilteredProducts={itemFilteredProducts}
          setItemFilteredProducts={setItemFilteredProducts}
          itemProductSearchFocused={itemProductSearchFocused}
          setItemProductSearchFocused={setItemProductSearchFocused}
          itemInputRefs={itemInputRefs}
          itemColumnConfig={itemColumnConfig}
          itemColumnVisibility={itemColumnVisibility}
          itemColumnWidths={itemColumnWidths}
          itemColumnOrder={itemColumnOrder}
          debugMode={debugMode}
          setDebugMode={setDebugMode}
          tableCollapsed={tableCollapsed}
          setTableCollapsed={setTableCollapsed}
          getProductInfo={getProductInfo}
          totalAmount={totalAmount}
        />

        {/* Customer Selection Modal */}
        {showCustomerModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '1rem',
            }}
            onClick={() => {
              setShowCustomerModal(false)
              setCustomerSearch('')
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '1.5rem',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '80vh',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Müştəri seçin</h3>
                <button
                  onClick={() => {
                    setShowCustomerModal(false)
                    setCustomerSearch('')
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#666',
                  }}
                >
                  ×
                </button>
              </div>
              <input
                type="text"
                value={customerSearch || ''}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  if (e.target.value.trim()) {
                    const term = e.target.value.toLowerCase()
                    setFilteredCustomers(
                      customers.filter(c => c.name?.toLowerCase().includes(term))
                    )
                  } else {
                    setFilteredCustomers([])
                  }
                }}
                placeholder="Müştəri axtar..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  marginBottom: '1rem',
                }}
              />
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => {
                      handleSelectCustomer(customer)
                      setShowCustomerModal(false)
                      setCustomerSearch('')
                    }}
                    style={{
                      padding: '0.75rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                      background: invoiceForm.customer_id === customer.id ? '#e7f3ff' : 'white',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f5f5f5'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = invoiceForm.customer_id === customer.id ? '#e7f3ff' : 'white'
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>{customer.name}</div>
                    {customer.phone && (
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>{customer.phone}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Product Selection Modal */}
        {showProductModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '1rem',
            }}
            onClick={() => {
              setShowProductModal(false)
              setProductSearch('')
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '1.5rem',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '80vh',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Məhsul əlavə et</h3>
                <button
                  onClick={() => {
                    setShowProductModal(false)
                    setProductSearch('')
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#666',
                  }}
                >
                  ×
                </button>
              </div>
              <input
                type="text"
                value={productSearch || ''}
                onChange={(e) => {
                  setProductSearch(e.target.value)
                  if (e.target.value.trim()) {
                    const term = e.target.value.toLowerCase()
                    setFilteredProducts(
                      products.filter(p => 
                        p.name?.toLowerCase().includes(term) ||
                        p.code?.toLowerCase().includes(term) ||
                        p.article?.toLowerCase().includes(term) ||
                        p.barcode?.toLowerCase().includes(term)
                      )
                    )
                  } else {
                    setFilteredProducts([])
                  }
                }}
                placeholder="Məhsul axtar..."
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  marginBottom: '1rem',
                }}
              />
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      handleAddProduct(product)
                      setShowProductModal(false)
                      setProductSearch('')
                    }}
                    style={{
                      padding: '0.75rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f0f0f0',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f5f5f5'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white'
                    }}
                  >
                    <div style={{ fontWeight: 'bold' }}>{product.name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {product.code && <span>Kod: {product.code}</span>}
                      {product.article && <span>Artikul: {product.article}</span>}
                      {product.barcode && <span>Barkod: {product.barcode}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {settingsModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '1rem',
            }}
            onClick={() => setSettingsModalOpen(false)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '1.5rem',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '80vh',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Ayarlar</h3>
                <button
                  onClick={() => setSettingsModalOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    color: '#666',
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem' }}>
                <button
                  onClick={() => setSettingsTab('columns')}
                  style={{
                    padding: '0.5rem 1rem',
                    background: settingsTab === 'columns' ? '#007bff' : '#f0f0f0',
                    color: settingsTab === 'columns' ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Sütunlar
                </button>
                <button
                  onClick={() => setSettingsTab('rows')}
                  style={{
                    padding: '0.5rem 1rem',
                    background: settingsTab === 'rows' ? '#007bff' : '#f0f0f0',
                    color: settingsTab === 'rows' ? 'white' : '#333',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Sətirlər
                </button>
              </div>
              {settingsTab === 'columns' && (
                <div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Sütunların görünüşü:</label>
                    {columnOrder.map((columnKey, index) => {
                      const config = columnConfig[columnKey]
                      return (
                        <div key={columnKey} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={columnVisibility[columnKey] ?? true}
                            onChange={(e) => {
                              setColumnVisibility(prev => ({
                                ...prev,
                                [columnKey]: e.target.checked,
                              }))
                            }}
                            style={{ marginRight: '0.5rem' }}
                          />
                          <label style={{ flex: 1 }}>{config.label}</label>
                          <button
                            onClick={() => handleMoveColumn(columnKey, 'left')}
                            disabled={index === 0}
                            style={{
                              padding: '0.25rem 0.5rem',
                              marginRight: '0.25rem',
                              background: index === 0 ? '#ccc' : '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: index === 0 ? 'not-allowed' : 'pointer',
                            }}
                          >
                            ←
                          </button>
                          <button
                            onClick={() => handleMoveColumn(columnKey, 'right')}
                            disabled={index === columnOrder.length - 1}
                            style={{
                              padding: '0.25rem 0.5rem',
                              background: index === columnOrder.length - 1 ? '#ccc' : '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: index === columnOrder.length - 1 ? 'not-allowed' : 'pointer',
                            }}
                          >
                            →
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    onClick={handleResetToDefaults}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Varsayılanlara qaytar
                  </button>
                </div>
              )}
              {settingsTab === 'rows' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Səhifədə göstəriləcək sətir sayı:</label>
                  <input
                    ref={rowsPerPageInput}
                    type="number"
                    value={rowsPerPage}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 10
                      setRowsPerPageInput(value.toString())
                    }}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value) || 10
                      if (value < 1) {
                        setRowsPerPage(10)
                        setRowsPerPageInput('10')
                      } else {
                        setRowsPerPage(value)
                      }
                    }}
                    min="1"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      marginBottom: '1rem',
                    }}
                  />
                </div>
              )}
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setSettingsModalOpen(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Bağla
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
