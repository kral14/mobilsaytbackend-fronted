import React, { useState, useEffect, useCallback } from 'react'
import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'
import DataTable, { ColumnConfig } from '../../components/DataTable'
import InvoiceModal, { type InvoiceItem, type ModalData } from '../../components/InvoiceModal'
import FilterModal, { FilterValue } from '../../components/FilterModal'
import { ordersAPI, productsAPI, customersAPI } from '../../services/api'
import type { SaleInvoice, Product, Customer } from '@shared/types'
import { formatDateDifference, calculateDaysDifference } from '../../utils/dateUtils'
import { useWindowStore } from '../../store/windowStore'

// CSS animasiya üçün style tag
const notificationStyles = `
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`

const defaultColumns: ColumnConfig[] = [
  { id: 'checkbox', label: '', visible: true, width: 50, order: 0 },
  { 
    id: 'is_active_status', 
    label: '', 
    visible: true, 
    width: 50, 
    order: 1, 
    align: 'center',
    render: (value: any) => {
      if (value === '✓') {
        return (
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
        )
      }
      return <span style={{ fontSize: '1.2rem' }}>📄</span>
    }
  },
  { id: 'id', label: 'ID', visible: true, width: 80, order: 2 },
  { id: 'invoice_number', label: 'Faktura №', visible: true, width: 150, order: 3 },
  { id: 'customer_name', label: 'Müştəri', visible: true, width: 200, order: 4 },
  { id: 'created_at', label: 'Yaradılma tarixi', visible: true, width: 150, order: 5 },
  { id: 'total_amount', label: 'Ümumi məbləğ', visible: true, width: 150, order: 6, align: 'right' },
  { id: 'payment_date', label: 'Son ödəniş tarixi', visible: true, width: 150, order: 7 },
  { id: 'days_remaining', label: 'Qalıb gün', visible: true, width: 120, order: 8, align: 'right' },
  { id: 'notes', label: 'Qeydlər', visible: true, width: 200, order: 9 },
]

// InvoiceItem və ModalData artıq InvoiceModal.tsx-dən import edilir

export default function SatisQaimeleri() {
  const [invoices, setInvoices] = useState<SaleInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredInvoices, setFilteredInvoices] = useState<SaleInvoice[]>([])
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<(number | string)[]>([])
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [activeFilters, setActiveFilters] = useState<FilterValue[]>([])
  const [currentSearchColumn, setCurrentSearchColumn] = useState<string | null>(null) // Ctrl+F basıldıqda hansı sütun üzərindədir
  const [lastClickedColumn, setLastClickedColumn] = useState<string | null>(null) // Son kliklənən sütun header-ı
  
  // Debug: currentSearchColumn dəyişdikdə log yaz
  useEffect(() => {
    console.log('[Satis.tsx] currentSearchColumn dəyişdi:', currentSearchColumn)
  }, [currentSearchColumn])
  
  // Debug: lastClickedColumn dəyişdikdə log yaz
  useEffect(() => {
    console.log('[Satis.tsx] lastClickedColumn dəyişdi:', lastClickedColumn)
  }, [lastClickedColumn])
  
  // Modal state - çoxlu modal dəstəyi
  const [openModals, setOpenModals] = useState<Map<string, ModalData>>(new Map())
  
  // Aktiv modal ID (ən üstdə olan)
  const [activeModalId, setActiveModalId] = useState<string | null>(null)
  
  // Base z-index (hər yeni modal üçün artırılır)
  const [baseZIndex, setBaseZIndex] = useState(1000)
  
  // Global window store
  const { windows, addWindow, removeWindow, updateWindow, minimizeWindow } = useWindowStore()
  
  // Köhnə modal state (backward compatibility)
  const [showModal, setShowModal] = useState(false)
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null)
  const [editingInvoiceIsActive, setEditingInvoiceIsActive] = useState<boolean>(false) // Redaktə edilən qaimənin təsdiq statusu
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([])
  const [notes, setNotes] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('') // Qaimə tarixi (saat, dəqiqə, saniyə ilə)
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  // Köhnə modal üçün state-lər (yalnız set funksiyaları istifadə olunur)
  const [_selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [_itemQuantity, setItemQuantity] = useState<number>(1)
  const [_itemPrice, setItemPrice] = useState<number>(0)
  const [_barcodeInput, setBarcodeInput] = useState('')
  const [_showBarcodeInput, setShowBarcodeInput] = useState(false)
  
  // Bildiriş state
  interface Notification {
    id: string
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
  }
  const [notifications, setNotifications] = useState<Notification[]>([])
  
  // Bildiriş göstər funksiyası
  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = `notification-${Date.now()}-${Math.random()}`
    setNotifications(prev => [...prev, { id, message, type }])
    
    // 4 saniyədən sonra avtomatik sil
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
    }, 4000)
  }, [])
  
  // Müştəri və məhsul modal state
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showItemSettingsModal, setShowItemSettingsModal] = useState(false)
  
  // Modal state-ləri (useEffect-dən əvvəl təyin olunmalıdır)
  const [isMinimized, setIsMinimized] = useState(false)
  const [minimizedModals, setMinimizedModals] = useState<Array<{
    id: string
    title: string
    type: 'qaime'
    data?: any
  }>>([])
  
  // Modal draggable və resizable üçün state (useEffect-dən ƏVVƏL təyin olunmalıdır)
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 })
  const [modalSize, setModalSize] = useState({ width: 900, height: 600 })
  const [isMaximized, setIsMaximized] = useState(false)
  
  // Pəncərələri izlə və taskbar-da göstər
  useEffect(() => {
    // Qaimə modalları - global store-a əlavə et
    Array.from(openModals.values()).forEach(modal => {
      const windowId = `invoice-modal-${modal.id}`
      const store = useWindowStore.getState()
      const existingWindow = store.windows.get(windowId)
      
      if (!existingWindow) {
        addWindow({
          id: windowId,
          title: modal.invoiceId ? `Qaimə #${modal.invoiceId}` : 'Yeni Qaimə',
          type: 'modal',
          modalType: 'qaime',
          isVisible: true,
          isMinimized: false,
          zIndex: modal.zIndex,
          position: modal.position,
          size: modal.size,
          isMaximized: modal.isMaximized,
          onActivate: () => {
            const newZIndex = baseZIndex + 1
            setBaseZIndex(newZIndex)
            setActiveModalId(modal.id)
            setOpenModals(prev => {
              const newMap = new Map(prev)
              const currentModal = newMap.get(modal.id)
              if (currentModal) {
                newMap.set(modal.id, { ...currentModal, zIndex: newZIndex })
              }
              return newMap
            })
            useWindowStore.getState().updateWindow(windowId, { zIndex: newZIndex, isVisible: true, isMinimized: false })
          },
          onRestore: () => {
            setActiveModalId(modal.id)
            setOpenModals(prev => {
              const newMap = new Map(prev)
              const currentModal = newMap.get(modal.id)
              if (currentModal) {
                newMap.set(modal.id, { ...currentModal, isMaximized: false })
              }
              return newMap
            })
          },
          onClose: () => {
            // Əvvəlcə modal state-lərini təmizlə
            setOpenModals(prev => {
              const newMap = new Map(prev)
              newMap.delete(modal.id)
              return newMap
            })
            if (activeModalId === modal.id) {
              const remainingModals = Array.from(openModals.values()).filter(m => m.id !== modal.id)
              if (remainingModals.length > 0) {
                const topModal = remainingModals.reduce((prev, curr) => 
                  curr.zIndex > prev.zIndex ? curr : prev
                )
                setActiveModalId(topModal.id)
              } else {
                setActiveModalId(null)
              }
            }
            // Sonra store-dan sil
            removeWindow(windowId)
          }
        })
      } else {
        // Mövcud window-u yenilə - yalnız həqiqətən dəyişiklik varsa
        const storeWindow = existingWindow
        // Store-dan isMinimized statusunu oxu - minimize olunmuşsa modal görünməməlidir
        const storeIsMinimized = storeWindow.isMinimized || false
        
        // Z-index dəyişikliyini yalnız əhəmiyyətli fərq varsa nəzərə al (1-dən çox)
        const zIndexChanged = storeWindow.zIndex !== modal.zIndex
        const zIndexDiffSignificant = zIndexChanged && Math.abs(storeWindow.zIndex - modal.zIndex) > 1
        
        // Position və size dəyişiklikləri
        const positionChanged = storeWindow.position?.x !== modal.position.x || storeWindow.position?.y !== modal.position.y
        const sizeChanged = storeWindow.size?.width !== modal.size.width || storeWindow.size?.height !== modal.size.height
        
        // Yalnız həqiqətən dəyişiklik varsa yenilə
        // QEYD: isMinimized və isVisible store-dan gəlir, modal state-dən deyil
        // Minimize statusunu store-dan oxuyuruq və ona uyğun təyin edirik
        const expectedIsVisible = !storeIsMinimized // Minimize olunmuşsa görünməməlidir
        
        // Yalnız position, size, zIndex və ya isMaximized dəyişibsə yenilə
        // isMinimized və isVisible store-dan gəlir və biz onu dəyişdirmirik
        const needsUpdate = 
          (zIndexChanged && zIndexDiffSignificant) ||
          positionChanged ||
          sizeChanged ||
          storeWindow.isMaximized !== modal.isMaximized
          
        if (needsUpdate) {
          updateWindow(windowId, {
            isVisible: expectedIsVisible,
            isMinimized: storeIsMinimized,
            zIndex: modal.zIndex,
            position: modal.position,
            size: modal.size,
            isMaximized: modal.isMaximized
          })
        }
      }
    })
    
    // Silinmiş modalları store-dan da sil
    const store = useWindowStore.getState()
    Array.from(store.windows.values())
      .filter(w => w.id.startsWith('invoice-modal-'))
      .forEach(window => {
        const modalId = window.id.replace('invoice-modal-', '')
        if (!openModals.has(modalId)) {
          removeWindow(window.id)
        }
      })
    
    // Köhnə qaimə modalı
    // Modal açıq olduqda store-a əlavə et, amma bağlandıqda silmə (səhifə dəyişəndə bağlanmamalıdır)
    const existingWindow = useWindowStore.getState().windows.get('old-invoice-modal')
    if (showModal) {
      // Yalnız əgər store-da yoxdursa əlavə et
      if (!existingWindow) {
        addWindow({
          id: 'old-invoice-modal',
          title: editingInvoiceId ? 'Qaiməni Redaktə Et' : 'Yeni Satış Qaiməsi',
          type: 'modal',
          modalType: 'invoice-edit',
          isVisible: showModal && !isMinimized,
          isMinimized: isMinimized,
          zIndex: 1000,
          position: modalPosition,
          size: modalSize,
          isMaximized: isMaximized,
          onActivate: () => {
            // Local state-i yenilə
            setIsMinimized(false)
            setShowModal(true)
            // Store-da isVisible true et (activateWindow artıq bunu edir, amma təminat üçün)
            const store = useWindowStore.getState()
            store.updateWindow('old-invoice-modal', { isVisible: true, isMinimized: false })
          },
          onRestore: () => {
            // Local state-i yenilə
            setIsMinimized(false)
            setShowModal(true)
          },
          onClose: () => {
            setShowModal(false)
            setIsMinimized(false)
            setActiveModalId(null)
            setEditingInvoiceId(null)
            setEditingInvoiceIsActive(false)
            setSelectedCustomerId(null)
            setSelectedCustomer(null)
            setInvoiceItems([])
            setNotes('')
            setPaymentDate('')
            setInvoiceNumber('')
            setInvoiceDate('')
            setSelectedProductId(null)
            setSelectedProduct(null)
            setItemQuantity(1)
            setItemPrice(0)
            setBarcodeInput('')
            setShowBarcodeInput(false)
            setCustomerSearchTerm('')
            setProductSearchTerm('')
            setShowCustomerDropdown(false)
            setShowProductDropdown(false)
            setSelectedItemIndices([])
            removeWindow('old-invoice-modal')
          }
        })
      } else {
        // Mövcud pəncərəni yenilə (isVisible, zIndex, position, size)
        // Amma yalnız dəyişiklik varsa yenilə (sonsuz döngünü qarşısını almaq üçün)
        const currentWindow = existingWindow
        const needsUpdate = 
          currentWindow.isVisible !== (showModal && !isMinimized) ||
          currentWindow.isMinimized !== isMinimized ||
          currentWindow.title !== (editingInvoiceId ? 'Qaiməni Redaktə Et' : 'Yeni Satış Qaiməsi')
        
        if (needsUpdate) {
          updateWindow('old-invoice-modal', {
            isVisible: showModal && !isMinimized,
            isMinimized: isMinimized,
            title: editingInvoiceId ? 'Qaiməni Redaktə Et' : 'Yeni Satış Qaiməsi',
            position: modalPosition,
            size: modalSize,
            isMaximized: isMaximized
          })
        }
      }
    } else {
      // showModal false olsa belə, store-dan silmə (səhifə dəyişəndə bağlanmamalıdır)
      // Yalnız isVisible false et (yalnız dəyişiklik varsa)
      if (existingWindow && existingWindow.isVisible) {
        updateWindow('old-invoice-modal', { isVisible: false })
      }
    }
    
    // Müştəri modalı
    const existingCustomerWindow = useWindowStore.getState().windows.get('customer-modal')
    if (showCustomerModal) {
      if (!existingCustomerWindow) {
        addWindow({
          id: 'customer-modal',
          title: 'Müştəri seçin',
          type: 'modal',
          modalType: 'customer',
          isVisible: showCustomerModal,
          isMinimized: false,
          zIndex: 2000,
          onActivate: () => {
            setShowCustomerModal(true)
          },
          onClose: () => {
            setShowCustomerModal(false)
            setCustomerModalSearchTerm('')
            removeWindow('customer-modal')
          }
        })
      } else {
        updateWindow('customer-modal', { isVisible: showCustomerModal })
      }
    } else {
      if (existingCustomerWindow) {
        updateWindow('customer-modal', { isVisible: false })
      }
    }
    
    // Məhsul modalı
    const existingProductWindow = useWindowStore.getState().windows.get('product-modal')
    if (showProductModal) {
      if (!existingProductWindow) {
        addWindow({
          id: 'product-modal',
          title: 'Məhsul seçin',
          type: 'modal',
          modalType: 'product',
          isVisible: showProductModal,
          isMinimized: false,
          zIndex: 2000,
          onActivate: () => {
            setShowProductModal(true)
          },
          onClose: () => {
            setShowProductModal(false)
            setProductModalSearchTerm('')
            removeWindow('product-modal')
          }
        })
      } else {
        updateWindow('product-modal', { isVisible: showProductModal })
      }
    } else {
      if (existingProductWindow) {
        updateWindow('product-modal', { isVisible: false })
      }
    }
    
    // Cədvəl ayarları modalı
    const existingSettingsWindow = useWindowStore.getState().windows.get('item-settings-modal')
    if (showItemSettingsModal) {
      if (!existingSettingsWindow) {
        addWindow({
          id: 'item-settings-modal',
          title: 'Cədvəl ayarları',
          type: 'modal',
          modalType: 'settings',
          isVisible: showItemSettingsModal,
          isMinimized: false,
          zIndex: 2000,
          onActivate: () => {
            setShowItemSettingsModal(true)
          },
          onClose: () => {
            setShowItemSettingsModal(false)
            removeWindow('item-settings-modal')
          }
        })
      } else {
        updateWindow('item-settings-modal', { isVisible: showItemSettingsModal })
      }
    } else {
      if (existingSettingsWindow) {
        updateWindow('item-settings-modal', { isVisible: false })
      }
    }
  }, [openModals, showModal, editingInvoiceId, isMinimized, showCustomerModal, showProductModal, showItemSettingsModal, baseZIndex, activeModalId, modalPosition, modalSize, isMaximized])
  const [customerSearchTerm, setCustomerSearchTerm] = useState('')
  const [_productSearchTerm, setProductSearchTerm] = useState('')
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false)
  const [_showProductDropdown, setShowProductDropdown] = useState(false)
  const [customerModalSearchTerm, setCustomerModalSearchTerm] = useState('')
  const [productModalSearchTerm, setProductModalSearchTerm] = useState('')
  
  // Məhsul cədvəli üçün state
  const [selectedItemIndices, setSelectedItemIndices] = useState<number[]>([])
  
  // Məhsul cədvəli sütunları üçün state
  const [itemTableColumns, setItemTableColumns] = useState({
    showNumber: true,
    showProduct: true,
    showQuantity: true,
    showUnitPrice: true,
    showTotal: true,
  })
  
  // Modal draggable və resizable üçün state (digər state-lər)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 })
  const [savedModalState, setSavedModalState] = useState<{ position: { x: number, y: number }, size: { width: number, height: number } } | null>(null)

  const loadInvoices = useCallback(async () => {
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
  }, [])

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term)
  }, [])

  // Çoxlu modal açmaq üçün funksiya
  const openModalForInvoice = useCallback(async (invoiceId: number | null = null) => {
    try {
      let fullInvoice: SaleInvoice | null = null
      if (invoiceId) {
        fullInvoice = await ordersAPI.getById(invoiceId.toString())
      }
      
      const modalId = invoiceId ? `modal-${invoiceId}-${Date.now()}` : `modal-new-${Date.now()}`
      
      // Yeni modalın pozisiyasını hesabla (mərkəzə yerləşdir)
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      const modalWidth = Math.min(900, screenWidth - 40)
      const modalHeight = Math.min(700, screenHeight - 80)
      
      // Payment date formatla
      let paymentDateStr = ''
      if (fullInvoice?.payment_date) {
        const date = new Date(fullInvoice.payment_date)
        paymentDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      }
      
      // Invoice date formatla - saat, dəqiqə, saniyə ilə
      let invoiceDateStr = ''
      if (fullInvoice?.invoice_date) {
        const date = new Date(fullInvoice.invoice_date)
        invoiceDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
      }
      
      // Invoice items formatla
      const invoiceItemsData = fullInvoice ? ((fullInvoice as any).sale_invoice_items || (fullInvoice as any).items || []) : []
      const items: InvoiceItem[] = invoiceItemsData.map((item: any) => ({
        product_id: item.product_id,
        product_name: item.products?.name || 'Naməlum məhsul',
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total_price: Number(item.total_price),
      }))
      
      const newZIndex = baseZIndex + 1
      
      const newModal: ModalData = {
        id: modalId,
        invoiceId: invoiceId,
        position: {
          x: Math.floor((screenWidth - modalWidth) / 2),
          y: Math.floor((screenHeight - modalHeight) / 2)
        },
        size: {
          width: modalWidth,
          height: modalHeight
        },
        isMaximized: false,
        zIndex: newZIndex,
        invoiceType: 'sale',
        isActive: fullInvoice ? (fullInvoice as any).is_active || false : undefined, // Qaimənin təsdiq statusu
        data: {
          selectedCustomerId: fullInvoice?.customer_id || null,
          selectedCustomer: fullInvoice?.customers || null,
          invoiceItems: items,
          notes: fullInvoice?.notes || '',
          paymentDate: paymentDateStr,
          invoiceNumber: fullInvoice?.invoice_number || '',
          invoiceDate: invoiceDateStr
        }
      }
      
      setBaseZIndex(newZIndex)
      setOpenModals(prev => {
        const newMap = new Map(prev)
        newMap.set(modalId, newModal)
        return newMap
      })
      setActiveModalId(modalId)
    } catch (err: any) {
      console.error('openModalForInvoice xətası:', err)
      showNotification(err.response?.data?.message || 'Qaimə yüklənərkən xəta baş verdi', 'error')
    }
  }, [baseZIndex, showNotification])

  const handleEdit = useCallback(async (selectedIds: (number | string)[]) => {
    if (selectedIds.length === 1) {
      const invoiceId = parseInt(selectedIds[0].toString())
      await openModalForInvoice(invoiceId)
    }
  }, [openModalForInvoice])

  const handleDelete = useCallback(async (selectedIds: (number | string)[]) => {
    if (confirm(`${selectedIds.length} qaimə silinsin?`)) {
      try {
        // TODO: Backend-də delete endpoint əlavə et
        // await Promise.all(selectedIds.map(id => ordersAPI.delete(id.toString())))
        await loadInvoices()
        showNotification('Qaimələr silindi', 'success')
      } catch (err: any) {
        showNotification(err.response?.data?.message || 'Silinərkən xəta baş verdi', 'error')
      }
    }
  }, [loadInvoices, showNotification])

  const handleCopy = useCallback((_selectedIds: (number | string)[]) => {
    // TODO: Kopyalama funksiyası
    showNotification('Kopyalama funksiyası hazırlanır...', 'info')
  }, [showNotification])

  const handlePrint = useCallback(async () => {
    // Seçilmiş sənədləri al
    const invoicesToPrint = selectedInvoiceIds.length > 0 
      ? invoices.filter(inv => selectedInvoiceIds.includes(inv.id))
      : []
    
    if (invoicesToPrint.length === 0) {
      showNotification('Çap üçün sənəd seçilməyib', 'warning')
      return
    }

    // Hər sənədi tam məlumatla yüklə
    const fullInvoices = await Promise.all(
      invoicesToPrint.map(async (inv) => {
        try {
          const fullInvoice = await ordersAPI.getById(inv.id.toString())
          return fullInvoice
        } catch (err) {
          console.error(`Sənəd ${inv.id} yüklənərkən xəta:`, err)
          return inv
        }
      })
    )

    // Sənədləri çap et
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      let htmlContent = `
        <html>
          <head>
            <title>Satış Qaimələri</title>
            <style>
              @media print {
                .invoice-break { page-break-after: always; }
              }
              body { font-family: Arial, sans-serif; padding: 20px; }
              .invoice { margin-bottom: 40px; border: 1px solid #ddd; padding: 20px; }
              .invoice-header { text-align: center; margin-bottom: 20px; }
              .invoice-header h2 { margin: 0; }
              .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
              .invoice-info div { flex: 1; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .total-row { font-weight: bold; background-color: #f9f9f9; }
              .text-right { text-align: right; }
            </style>
          </head>
          <body>
      `

      fullInvoices.forEach((invoice: SaleInvoice, index: number) => {
        const invoiceDate = invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('az-AZ') : '-'
        const paymentDate = invoice.payment_date ? new Date(invoice.payment_date).toLocaleDateString('az-AZ') : '-'
        const items = invoice.sale_invoice_items || []
        const totalAmount = invoice.total_amount ? Number(invoice.total_amount) : 0

        htmlContent += `
          <div class="invoice ${index < fullInvoices.length - 1 ? 'invoice-break' : ''}">
            <div class="invoice-header">
              <h2>SATIŞ QAIMƏSİ</h2>
            </div>
            <div class="invoice-info">
              <div>
                <p><strong>Faktura №:</strong> ${invoice.invoice_number || ''}</p>
                <p><strong>Tarix:</strong> ${invoiceDate}</p>
                ${paymentDate !== '-' ? `<p><strong>Son ödəniş tarixi:</strong> ${paymentDate}</p>` : ''}
              </div>
              <div>
                <p><strong>Müştəri:</strong> ${invoice.customers?.name || '-'}</p>
                ${invoice.customers?.phone ? `<p><strong>Telefon:</strong> ${invoice.customers.phone}</p>` : ''}
                ${invoice.customers?.address ? `<p><strong>Ünvan:</strong> ${invoice.customers.address}</p>` : ''}
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>№</th>
                  <th>Məhsul</th>
                  <th class="text-right">Miqdar</th>
                  <th class="text-right">Vahid qiymət</th>
                  <th class="text-right">Cəmi</th>
                </tr>
              </thead>
              <tbody>
                ${items.map((item: any, idx: number) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${item.products?.name || 'Naməlum məhsul'}</td>
                    <td class="text-right">${Number(item.quantity).toFixed(2)}</td>
                    <td class="text-right">${Number(item.unit_price).toFixed(2)} ₼</td>
                    <td class="text-right">${Number(item.total_price).toFixed(2)} ₼</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="4" class="text-right"><strong>Ümumi məbləğ:</strong></td>
                  <td class="text-right"><strong>${totalAmount.toFixed(2)} ₼</strong></td>
                </tr>
              </tfoot>
            </table>
            ${invoice.notes ? `<p style="margin-top: 20px;"><strong>Qeydlər:</strong> ${invoice.notes}</p>` : ''}
          </div>
        `
      })

      htmlContent += `
          </body>
        </html>
      `

      printWindow.document.write(htmlContent)
      printWindow.document.close()
      printWindow.print()
    }
  }, [selectedInvoiceIds, invoices, showNotification])

  useEffect(() => {
    loadInvoices()
    loadCustomers()
    loadProducts()
    
    // localStorage-dan modal ölçüsünü yüklə
    const savedSize = localStorage.getItem('satis-qaime-modal-size')
    if (savedSize) {
      try {
        const parsed = JSON.parse(savedSize)
        setModalSize(parsed)
      } catch (e) {
        console.error('Modal ölçüsü yüklənərkən xəta:', e)
      }
    }
  }, [loadInvoices])

  // Qısa yollar (yalnız modal açıq deyilsə)
  useEffect(() => {
    // Modal açıq olduqda qısa yolları deaktiv et
    const hasOpenModals = openModals.size > 0
    if (hasOpenModals) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Input və textarea elementlərində qısa yolları deaktiv et
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        // Ctrl+F və Ctrl+P istisna olaraq işləsin
        if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
          e.preventDefault()
          const searchInput = document.querySelector('input[placeholder*="Axtarış"]') as HTMLInputElement
          if (searchInput) {
            searchInput.focus()
            searchInput.select()
          }
          return
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
          e.preventDefault()
          handlePrint()
          return
        }
        // Digər qısa yollar input içində işləməsin
        if (e.key === 'Insert' || e.key === 'F2' || e.key === 'F9' || e.key === 'Delete' || e.key === 'F5') {
          return
        }
      }

      // F5: Cədvəli yenilə
      if (e.key === 'F5') {
        e.preventDefault()
        loadInvoices()
        return
      }

      // Insert: Yeni qaimə
      if (e.key === 'Insert') {
        e.preventDefault()
        openModalForInvoice(null)
        return
      }

      // Ctrl+F: Axtarış
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        console.log('[Satis.tsx] Ctrl+F basıldı')
        e.preventDefault()
        e.stopPropagation()
        
        // Cədvəl sütun header-ında basılıbsa, həmin sütunu müəyyən et
        // Əvvəlcə e.target-dən, sonra document.activeElement-dən yoxla
        const target = (e.target as HTMLElement) || document.activeElement as HTMLElement
        console.log('[Satis.tsx] Ctrl+F target:', target, 'tagName:', target.tagName, 'className:', target.className)
        console.log('[Satis.tsx] Ctrl+F activeElement:', document.activeElement, 'tagName:', document.activeElement?.tagName)
        
        // Əvvəlcə target-dən yoxla
        let th = target.closest('th[data-column-id]') as HTMLElement
        console.log('[Satis.tsx] Ctrl+F target-dən closest th:', th)
        
        // Əgər tapılmadısa, activeElement-dən yoxla
        if (!th && document.activeElement) {
          th = (document.activeElement as HTMLElement).closest('th[data-column-id]') as HTMLElement
          console.log('[Satis.tsx] Ctrl+F activeElement-dən closest th:', th)
        }
        
        // Əgər hələ də tapılmadısa, son kliklənən sütundan istifadə et
        let selectedColumnId: string | null = null
        
        console.log('[Satis.tsx] Ctrl+F th tapıldı:', !!th, 'lastClickedColumn:', lastClickedColumn)
        
        if (th) {
          selectedColumnId = th.getAttribute('data-column-id')
          console.log('[Satis.tsx] Ctrl+F columnId tapıldı (th-dən):', selectedColumnId)
        } else if (lastClickedColumn) {
          selectedColumnId = lastClickedColumn
          console.log('[Satis.tsx] Ctrl+F son kliklənən sütundan istifadə edilir:', lastClickedColumn)
        } else {
          console.log('[Satis.tsx] Ctrl+F sütun header-ında deyil və son kliklənən sütun yoxdur, bütün sütunlarda axtar')
          console.log('[Satis.tsx] Ctrl+F lastClickedColumn state dəyəri:', lastClickedColumn)
        }
        
        console.log('[Satis.tsx] Ctrl+F selectedColumnId:', selectedColumnId)
        
        if (selectedColumnId && selectedColumnId !== 'checkbox' && selectedColumnId !== 'is_active_status') {
          console.log('[Satis.tsx] Ctrl+F sütun seçildi:', selectedColumnId)
          console.log('[Satis.tsx] Ctrl+F setCurrentSearchColumn çağırılır:', selectedColumnId)
          setCurrentSearchColumn(selectedColumnId)
          if (th) {
            console.log('[Satis.tsx] Ctrl+F setLastClickedColumn çağırılır:', selectedColumnId)
            setLastClickedColumn(selectedColumnId) // Son kliklənən sütunu yenilə
          }
        } else {
          console.log('[Satis.tsx] Ctrl+F sütun seçilmədi - selectedColumnId:', selectedColumnId, 'is checkbox:', selectedColumnId === 'checkbox', 'is is_active_status:', selectedColumnId === 'is_active_status')
          setCurrentSearchColumn(null)
        }
        
        const searchInput = document.querySelector('input[placeholder*="Axtarış"]') as HTMLInputElement
        console.log('[Satis.tsx] Ctrl+F searchInput tapıldı:', searchInput)
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
          console.log('[Satis.tsx] Ctrl+F searchInput focus və select edildi')
        } else {
          console.warn('[Satis.tsx] Ctrl+F searchInput tapılmadı!')
        }
        return
      }

      // F2: Redaktə (seçilmiş qaiməni aç)
      if (e.key === 'F2') {
        e.preventDefault()
        if (selectedInvoiceIds.length === 1) {
          handleEdit(selectedInvoiceIds)
        } else if (selectedInvoiceIds.length > 1) {
          showNotification('Yalnız bir qaimə seçilməlidir', 'warning')
        } else {
          showNotification('Qaimə seçilməyib', 'warning')
        }
        return
      }

      // Delete: Silmək
      if (e.key === 'Delete') {
        e.preventDefault()
        if (selectedInvoiceIds.length > 0) {
          handleDelete(selectedInvoiceIds)
        } else {
          showNotification('Qaimə seçilməyib', 'warning')
        }
        return
      }

      // F9: Kopyala
      if (e.key === 'F9') {
        e.preventDefault()
        if (selectedInvoiceIds.length > 0) {
          handleCopy(selectedInvoiceIds)
        } else {
          showNotification('Qaimə seçilməyib', 'warning')
        }
        return
      }

      // Ctrl+P: Çap
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        handlePrint()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [loadInvoices, selectedInvoiceIds, handleEdit, handleDelete, handleCopy, handlePrint, openModalForInvoice, openModals, showNotification])

  const loadCustomers = async () => {
    try {
      const data = await customersAPI.getAll()
      setCustomers(data)
    } catch (err: any) {
      console.error('Müştərilər yüklənərkən xəta:', err)
    }
  }

  const loadProducts = async () => {
    try {
      const data = await productsAPI.getAll()
      setProducts(data)
    } catch (err: any) {
      console.error('Məhsullar yüklənərkən xəta:', err)
    }
  }

  const filterInvoices = useCallback(() => {
    let filtered = [...invoices]

    // Axtarış termini ilə filtr
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(invoice => {
        // Əgər konkret sütun seçilibsə, yalnız həmin sütunda axtar
        if (currentSearchColumn) {
          switch (currentSearchColumn) {
            case 'invoice_number':
              return invoice.invoice_number?.toLowerCase().includes(term)
            case 'customer_name':
              return invoice.customers?.name?.toLowerCase().includes(term)
            case 'notes':
              return invoice.notes?.toLowerCase().includes(term)
            case 'total_amount':
              return invoice.total_amount?.toString().includes(term)
            case 'id':
              return invoice.id?.toString().includes(term)
            default:
              return true
          }
        }
        // Əgər sütun seçilməyibsə, bütün sütunlarda axtar
        return (
          invoice.invoice_number?.toLowerCase().includes(term) ||
          invoice.customers?.name?.toLowerCase().includes(term) ||
          invoice.notes?.toLowerCase().includes(term) ||
          invoice.total_amount?.toString().includes(term)
        )
      })
    }

    // Aktiv filtrlər ilə filtr
    if (activeFilters.length > 0) {
      filtered = filtered.filter(invoice => {
        return activeFilters.every(filter => {
          switch (filter.columnId) {
            case 'customer_id':
              if (filter.type === 'single') {
                return invoice.customer_id === filter.value
              } else if (filter.type === 'multiple' && filter.values) {
                return filter.values.includes(invoice.customer_id)
              }
              return true
            case 'invoice_number':
              if (filter.type === 'single') {
                return invoice.invoice_number?.toLowerCase().includes(String(filter.value).toLowerCase())
              } else if (filter.type === 'multiple' && filter.values) {
                return filter.values.some(v => invoice.invoice_number?.toLowerCase().includes(String(v).toLowerCase()))
              }
              return true
            case 'total_amount':
              if (filter.type === 'single') {
                return Number(invoice.total_amount) === Number(filter.value)
              } else if (filter.type === 'multiple' && filter.values) {
                return filter.values.some(v => Number(invoice.total_amount) === Number(v))
              }
              return true
            case 'product_id':
              // Məhsul filtrini tətbiq et - qaimədə seçilən məhsullardan hər hansı biri varsa
              if (filter.type === 'multiple' && filter.values && filter.values.length > 0) {
                // Qaimənin məhsullarını yoxla
                if (invoice.sale_invoice_items && invoice.sale_invoice_items.length > 0) {
                  return invoice.sale_invoice_items.some((item: any) => 
                    item.product_id && filter.values!.includes(item.product_id)
                  )
                }
                return false
              }
              return true
            default:
              return true
          }
        })
      })
    }

    setFilteredInvoices(filtered)
  }, [invoices, searchTerm, currentSearchColumn, activeFilters])

  useEffect(() => {
    filterInvoices()
  }, [filterInvoices])

  const handleAddEmptyRow = () => {
    const newItem: InvoiceItem = {
      product_id: null,
      product_name: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      searchTerm: ''
    }
    setInvoiceItems([...invoiceItems, newItem])
  }

  const handleProductSelectInRow = (index: number, productId: number) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    const updatedItems = [...invoiceItems]
    updatedItems[index] = {
      ...updatedItems[index],
      product_id: productId,
      product_name: product.name,
      unit_price: Number(product.sale_price) || 0,
      total_price: updatedItems[index].quantity * (Number(product.sale_price) || 0),
      searchTerm: ''
    }
    setInvoiceItems(updatedItems)
  }

  const handleProductSearchInRow = (index: number, searchTerm: string) => {
    const updatedItems = [...invoiceItems]
    updatedItems[index] = {
      ...updatedItems[index],
      searchTerm: searchTerm
    }
    setInvoiceItems(updatedItems)
  }


  const handleRemoveSelectedItems = () => {
    if (selectedItemIndices.length === 0) {
      showNotification('Sətir seçilməyib', 'warning')
      return
    }
    const sortedIndices = [...selectedItemIndices].sort((a, b) => b - a) // Ən böyükdən kiçiyə
    const newItems = [...invoiceItems]
    sortedIndices.forEach(index => {
      newItems.splice(index, 1)
    })
    setInvoiceItems(newItems)
    setSelectedItemIndices([])
  }

  const handleCopySelectedItems = () => {
    if (selectedItemIndices.length === 0) {
      showNotification('Sətir seçilməyib', 'warning')
      return
    }
    const sortedIndices = [...selectedItemIndices].sort((a, b) => a - b) // Kiçikdən böyüyə
    const copiedItems = sortedIndices.map(index => ({ ...invoiceItems[index] }))
    const newItems = [...invoiceItems, ...copiedItems]
    setInvoiceItems(newItems)
    setSelectedItemIndices([])
  }

  const handleMoveItemUp = () => {
    if (selectedItemIndices.length !== 1) {
      showNotification('Yalnız bir sətir seçilməlidir', 'warning')
      return
    }
    const index = selectedItemIndices[0]
    if (index === 0) return
    
    const newItems = [...invoiceItems]
    const temp = newItems[index]
    newItems[index] = newItems[index - 1]
    newItems[index - 1] = temp
    setInvoiceItems(newItems)
    setSelectedItemIndices([index - 1])
  }

  const handleMoveItemDown = () => {
    if (selectedItemIndices.length !== 1) {
      showNotification('Yalnız bir sətir seçilməlidir', 'warning')
      return
    }
    const index = selectedItemIndices[0]
    if (index === invoiceItems.length - 1) return
    
    const newItems = [...invoiceItems]
    const temp = newItems[index]
    newItems[index] = newItems[index + 1]
    newItems[index + 1] = temp
    setInvoiceItems(newItems)
    setSelectedItemIndices([index + 1])
  }

  const handleToggleItemSelection = (index: number) => {
    if (selectedItemIndices.includes(index)) {
      setSelectedItemIndices(selectedItemIndices.filter(i => i !== index))
    } else {
      setSelectedItemIndices([...selectedItemIndices, index])
    }
  }

  const handleSelectAllItems = () => {
    if (selectedItemIndices.length === invoiceItems.length) {
      setSelectedItemIndices([])
    } else {
      setSelectedItemIndices(invoiceItems.map((_, i) => i))
    }
  }

  // Modal drag və resize funksiyaları
  const handleModalMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // Düymələrə klikləyəndə drag işləməsin
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return
    }
    if ((target.classList.contains('modal-header') || target.closest('.modal-header')) && !isMaximized) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - modalPosition.x, y: e.clientY - modalPosition.y })
    }
  }

  const handleModalResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeStart({ x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !isMaximized) {
        // Ekran sərhədləri daxilində saxla
        const newX = Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - modalSize.width))
        const newY = Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - modalSize.height))
        setModalPosition({
          x: newX,
          y: newY
        })
      }
      if (isResizing && !isMaximized) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y
        setModalSize({
          width: Math.max(400, Math.min(modalSize.width + deltaX, window.innerWidth - modalPosition.x)),
          height: Math.max(300, Math.min(modalSize.height + deltaY, window.innerHeight - modalPosition.y))
        })
        setResizeStart({ x: e.clientX, y: e.clientY })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, dragStart, resizeStart, modalSize, modalPosition, isMaximized])

  // Modal açılanda mərkəzə yerləşdir və ya yadda saxlanılmış ölçüdə aç
  useEffect(() => {
    if (!showModal) return
    
    // Əgər taskbar-dan açılırsa, onun öz ölçüsünü istifadə et
    if (activeModalId) {
      const minimizedModal = minimizedModals.find(m => m.id === activeModalId)
      if (minimizedModal?.data?.modalSize) {
        setModalSize(minimizedModal.data.modalSize)
        setModalPosition(minimizedModal.data.modalPosition || { 
          x: (window.innerWidth - minimizedModal.data.modalSize.width) / 2, 
          y: (window.innerHeight - minimizedModal.data.modalSize.height) / 2 
        })
        setIsMaximized(false)
        return
      }
    }
    
    // Yeni modal və ya taskbar-dan olmayan modal üçün localStorage-dan yüklə
    const savedSize = localStorage.getItem('satis-qaime-modal-size')
    if (savedSize) {
      try {
        const parsed = JSON.parse(savedSize)
        setModalSize(parsed)
        setModalPosition({ 
          x: (window.innerWidth - parsed.width) / 2, 
          y: (window.innerHeight - parsed.height) / 2 
        })
      } catch (e) {
        console.error('Modal ölçüsü yüklənərkən xəta:', e)
        const defaultSize = { width: 900, height: 600 }
        setModalPosition({ 
          x: (window.innerWidth - defaultSize.width) / 2, 
          y: (window.innerHeight - defaultSize.height) / 2 
        })
      }
    } else {
      const defaultSize = { width: 900, height: 600 }
      setModalPosition({ 
        x: (window.innerWidth - defaultSize.width) / 2, 
        y: (window.innerHeight - defaultSize.height) / 2 
      })
    }
    setIsMaximized(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, activeModalId])

  // Modal ölçüsü dəyişəndə localStorage-a yaz və minimize edilmiş modallarda yenilə
  useEffect(() => {
    if (isMaximized || modalSize.width <= 0 || modalSize.height <= 0) return
    
    // localStorage-a yaz (ümumi default ölçü)
    localStorage.setItem('satis-qaime-modal-size', JSON.stringify(modalSize))
    
    // Əgər aktiv modal varsa, onun məlumatlarını da yenilə
    if (activeModalId && showModal) {
      setMinimizedModals(prev => prev.map(m => {
        if (m.id === activeModalId) {
          return {
            ...m,
            data: {
              ...m.data,
              modalSize,
              modalPosition
            }
          }
        }
        return m
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalSize.width, modalSize.height, modalPosition.x, modalPosition.y, isMaximized, activeModalId, showModal])

  // Maximize funksiyası
  const handleMaximize = () => {
    if (!isMaximized) {
      // Cari vəziyyəti yadda saxla
      setSavedModalState({
        position: { ...modalPosition },
        size: { ...modalSize }
      })
      // Tam ekran et
      setIsMaximized(true)
      setModalPosition({ x: 0, y: 0 })
      setModalSize({ width: window.innerWidth, height: window.innerHeight })
    } else {
      // Yadda saxlanılmış vəziyyətə qayıt
      if (savedModalState) {
        setModalPosition(savedModalState.position)
        setModalSize(savedModalState.size)
      }
      setIsMaximized(false)
    }
  }

  // Minimize funksiyası (taskbar-a göndər)
  const handleMinimize = () => {
    if (isMaximized) {
      handleMaximize() // Maximize-dan çıx
    }
    
    // Store-dan minimize et (local state-i store avtomatik yeniləyəcək)
    minimizeWindow('old-invoice-modal')
    // Local state-i də yenilə (UI re-render üçün)
    setIsMinimized(true)
  }

  // Taskbar-dan modalı aç (köhnə modal üçün - indi istifadə olunmur)
  // const handleRestoreFromTaskbar = (modalId: string) => { ... }

  // Taskbar-dan modalı bağla
  const handleCloseFromTaskbar = (modalId: string) => {
    setMinimizedModals(prev => prev.filter(m => m.id !== modalId))
    if (activeModalId === modalId) {
      setActiveModalId(null)
      setIsMinimized(false)
    }
  }

  // Modalı bağla (taskbar-dan da sil)
  const handleCloseModal = useCallback(() => {
    // Əgər minimize edilmişdirsə, taskbar-dan sil
    if (isMinimized && activeModalId) {
      handleCloseFromTaskbar(activeModalId)
    }
    
    setShowModal(false)
    setIsMinimized(false)
    setActiveModalId(null)
    setEditingInvoiceId(null)
    setEditingInvoiceIsActive(false)
    setInvoiceItems([])
    setSelectedCustomerId(null)
    setSelectedCustomer(null)
    setNotes('')
    setPaymentDate('')
    setInvoiceNumber('')
    setInvoiceDate('')
    setSelectedProductId(null)
    setSelectedProduct(null)
    setItemQuantity(1)
    setItemPrice(0)
    setBarcodeInput('')
    setShowBarcodeInput(false)
    setCustomerSearchTerm('')
    setProductSearchTerm('')
    setShowCustomerDropdown(false)
    setShowProductDropdown(false)
    setSelectedItemIndices([])
  }, [isMinimized, activeModalId])

  const handleUpdateItem = (index: number, field: 'quantity' | 'unit_price', value: number) => {
    const updatedItems = [...invoiceItems]
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value,
      total_price: field === 'quantity' 
        ? value * updatedItems[index].unit_price
        : updatedItems[index].quantity * value
    }
    setInvoiceItems(updatedItems)
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

  const handleProductChange = (productId: number) => {
    setSelectedProductId(productId)
    const product = products.find(p => p.id === productId)
    if (product) {
      setSelectedProduct(product)
      if (product.sale_price) {
        setItemPrice(Number(product.sale_price))
      }
    }
  }

  // Barkod scan handler (köhnə modal üçün - indi istifadə olunmur)
  // const handleBarcodeScan = (barcode: string) => { ... }

  // Barkod input handler (köhnə modal üçün - indi istifadə olunmur)
  // const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // const handleBarcodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { ... }

  const filteredCustomers = React.useMemo(() => {
    if (!customerSearchTerm.trim()) return []
    const term = customerSearchTerm.toLowerCase()
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(term) ||
      customer.phone?.toLowerCase().includes(term) ||
      customer.email?.toLowerCase().includes(term)
    ).slice(0, 10) // Maksimum 10 nəticə
  }, [customers, customerSearchTerm])


  const filteredCustomersForModal = React.useMemo(() => {
    if (!customerModalSearchTerm.trim()) return customers
    const term = customerModalSearchTerm.toLowerCase()
    return customers.filter(customer =>
      customer.name.toLowerCase().includes(term) ||
      customer.phone?.toLowerCase().includes(term) ||
      customer.email?.toLowerCase().includes(term)
    )
  }, [customers, customerModalSearchTerm])

  const filteredProductsForModal = React.useMemo(() => {
    if (!productModalSearchTerm.trim()) return products
    const term = productModalSearchTerm.toLowerCase()
    return products.filter(product =>
      product.name.toLowerCase().includes(term) ||
      product.code?.toLowerCase().includes(term) ||
      product.barcode?.toLowerCase().includes(term)
    )
  }, [products, productModalSearchTerm])

  // Tarix formatlaşdırma funksiyası
  const formatDateInput = (input: string): string => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() + 1
    
    // Təmizlə: yalnız rəqəmlər və nöqtələr
    const cleaned = input.replace(/[^\d.]/g, '')
    
    // Formatlar: "15", "15.11", "15.11.2025"
    const parts = cleaned.split('.')
    
    if (parts.length === 1 && parts[0]) {
      // Sadəcə gün: "15" -> "15.11.2025"
      const day = parseInt(parts[0])
      if (day >= 1 && day <= 31) {
        return `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
    } else if (parts.length === 2 && parts[0] && parts[1]) {
      // Gün və ay: "15.11" -> "15.11.2025"
      const day = parseInt(parts[0])
      const month = parseInt(parts[1])
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
    } else if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      // Tam tarix: "15.11.2025" -> "2025-11-15"
      const day = parseInt(parts[0])
      const month = parseInt(parts[1])
      const year = parseInt(parts[2])
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000 && year <= 2100) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
    }
    
    return input // Əgər format düzgün deyilsə, olduğu kimi qaytar
  }

  // F4 qısayolu üçün useEffect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F4 basıldıqda
      if (e.key === 'F4') {
        // Aktiv element yoxla
        const activeElement = document.activeElement as HTMLElement
        
        // Müştəri input-undadırsa
        if (activeElement && activeElement.getAttribute('data-customer-input') === 'true') {
          e.preventDefault()
          setShowCustomerModal(true)
        }
        
        // Məhsul input-undadırsa (modal içində)
        if (activeElement && activeElement.getAttribute('data-product-input') === 'true') {
          e.preventDefault()
          setShowProductModal(true)
        }
        
        // Cədvəldəki məhsul input-undadırsa
        if (activeElement && activeElement.getAttribute('data-product-row-input') === 'true') {
          e.preventDefault()
          const rowIndex = activeElement.getAttribute('data-row-index')
          if (rowIndex !== null) {
            setShowProductModal(true)
            // Seçilmiş sətiri yadda saxla ki, modal bağlandıqdan sonra o sətirə məhsul əlavə edə bilək
            sessionStorage.setItem('selectedProductRowIndex', rowIndex)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSaveInvoice = async (confirmInvoice: boolean = false) => {
    // Validasiya
    if (!selectedCustomerId) {
      showNotification('Müştəri seçilməlidir', 'warning')
      return
    }
    
    // Validasiya - məhsul seçilməlidir
    const validItems = invoiceItems.filter(item => item.product_id !== null)
    if (validItems.length === 0) {
      showNotification('Ən azı bir məhsul seçilməlidir', 'warning')
      return
    }

    try {
      const items = validItems.map(item => ({
        product_id: item.product_id!,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }))

      if (editingInvoiceId) {
        // Redaktə
        await ordersAPI.update(editingInvoiceId.toString(), {
          customer_id: selectedCustomerId,
          items,
          notes: notes || undefined,
          payment_date: paymentDate || undefined,
          invoice_number: invoiceNumber || undefined,
          invoice_date: invoiceDate || undefined,
        })
        
        // Qaimə yeniləndikdən sonra siyahını yenilə
        await loadInvoices()
        
        // Yenilənmiş qaiməni yenidən yüklə ki, kod düzgün görünsün
        const updatedInvoice = await ordersAPI.getById(editingInvoiceId.toString())
        setInvoiceNumber(updatedInvoice.invoice_number || '')
        
        // Qaimənin vəziyyətini təyin et
        if (confirmInvoice) {
          // OK düyməsi - həmişə təsdiq edir
          await ordersAPI.updateStatus(editingInvoiceId.toString(), true)
          setEditingInvoiceIsActive(true) // Statusu yenilə
          showNotification('Qaimə uğurla yeniləndi və təsdiq edildi', 'success')
        } else {
          // Yadda saxla düyməsi
          // Əgər qaimə təsdiqlidirsə, təsdiqli qalır
          // Əgər qaimə təsdiqsizdirsə, təsdiqsiz qalır
          await ordersAPI.updateStatus(editingInvoiceId.toString(), editingInvoiceIsActive)
          showNotification('Qaimə uğurla yeniləndi', 'success')
        }
      } else {
        // Yeni qaimə
        const newInvoice = await ordersAPI.create({
          customer_id: selectedCustomerId,
          items,
          notes: notes || undefined,
          payment_date: paymentDate || undefined,
          invoice_number: invoiceNumber || undefined,
          invoice_date: invoiceDate || undefined,
          is_active: confirmInvoice, // Təsdiq edilməlidirsə true, yoxsa false
        })
        
        // Qaimə yaradıldıqdan sonra siyahını yenilə ki, qaimə nömrəsi göstərilsin
        await loadInvoices()
        
        // Yeni yaradılan qaiməni redaktə rejiminə keçir ki, qaimə nömrəsi görünsün
        if (newInvoice.id) {
          setEditingInvoiceId(newInvoice.id)
          // Backend-dən qayıdan qaimə nömrəsini göstər
          setInvoiceNumber(newInvoice.invoice_number || '')
          
          showNotification(confirmInvoice ? 'Qaimə uğurla yaradıldı və təsdiq edildi' : 'Qaimə uğurla yaradıldı (təsdiqsiz)', 'success')
          // Modal açıq qalır, yalnız qaimə nömrəsi görünəcək
        }
        
        // Modalı bağlama, yalnız təmizləmə apar
        // setShowModal(false) - komment edildi, modal açıq qalır
        // setEditingInvoiceId(null) - komment edildi, yeni qaimə ID-si saxlanılır
        // setInvoiceItems([]) - komment edildi, məhsullar saxlanılır
        // setSelectedCustomerId(null) - komment edildi, müştəri saxlanılır
        // setSelectedCustomer(null) - komment edildi, müştəri saxlanılır
        // setNotes('') - komment edildi, qeydlər saxlanılır
        // setPaymentDate('') - komment edildi, tarix saxlanılır
        setSelectedProductId(null)
        setSelectedProduct(null)
        setItemQuantity(1)
        setItemPrice(0)
        setBarcodeInput('')
        setShowBarcodeInput(false)
        setCustomerSearchTerm('')
        setProductSearchTerm('')
        setShowCustomerDropdown(false)
        setShowProductDropdown(false)
        return // Funksiyadan çıx ki, modal açıq qalsın
      }

      // Redaktə üçün modalı bağla və təmizlə
      setShowModal(false)
      setEditingInvoiceId(null)
      setEditingInvoiceIsActive(false)
      setInvoiceItems([])
      setSelectedCustomerId(null)
      setSelectedCustomer(null)
      setNotes('')
      setPaymentDate('')
      setInvoiceNumber('')
      setInvoiceDate('')
      setSelectedProductId(null)
      setSelectedProduct(null)
      setItemQuantity(1)
      setItemPrice(0)
      setBarcodeInput('')
      setShowBarcodeInput(false)
      setCustomerSearchTerm('')
      setProductSearchTerm('')
      setShowCustomerDropdown(false)
      setShowProductDropdown(false)
      await loadInvoices()
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Qaimə yadda saxlanarkən xəta baş verdi', 'error')
    }
  }

  const handleOk = async () => {
    await handleSaveInvoice(true) // Təsdiq edilmiş qaimə
  }

  const handleSaveWithoutConfirm = async () => {
    await handleSaveInvoice(false) // Təsdiq edilməmiş qaimə
  }

  const totalAmount = invoiceItems.reduce((sum, item) => sum + item.total_price, 0)

  // DataTable üçün məlumatları formatla
  const tableData = filteredInvoices.map(invoice => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const paymentDate = invoice.payment_date ? new Date(invoice.payment_date) : null
    let daysRemaining: number | string = '-'
    
    if (paymentDate) {
      paymentDate.setHours(0, 0, 0, 0)
      const diff = calculateDaysDifference(today, paymentDate)
      daysRemaining = diff
    }

    const { invoice_date, ...invoiceWithoutDate } = invoice
    return {
      ...invoiceWithoutDate,
      is_active_status: (invoice as any).is_active ? '✓' : '',
      customer_name: invoice.customers?.name || '-',
      created_at: invoice.created_at ? new Date(invoice.created_at).toLocaleString('az-AZ', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }) : '-',
      payment_date: invoice.payment_date ? new Date(invoice.payment_date).toLocaleDateString('az-AZ') : '-',
      days_remaining: daysRemaining === '-' ? '-' : (typeof daysRemaining === 'number' ? (daysRemaining < 0 ? `${Math.abs(daysRemaining)} gün keçib` : `${daysRemaining} gün qalıb`) : daysRemaining),
      total_amount: invoice.total_amount ? `${Number(invoice.total_amount).toFixed(2)} ₼` : '0.00 ₼',
    }
  })

  return (
    <ProtectedRoute>
      <style>{notificationStyles}</style>
      <Layout>
        <DataTable
          pageId="satis-qaimeleri"
          columns={defaultColumns}
          data={tableData}
          loading={loading}
          error={error}
          title=""
          getRowId={(row) => row.id}
          defaultColumns={defaultColumns}
          toolbarActions={{
            onSettings: () => {},
            onEdit: handleEdit,
            onDelete: handleDelete,
            onCopy: handleCopy,
            onPrint: handlePrint,
          }}
          contextMenuActions={{
            onSettings: () => {},
            onEdit: handleEdit,
            onDelete: handleDelete,
            onCopy: handleCopy,
            onPrint: handlePrint,
            onActivate: async (selectedIds: (number | string)[]) => {
              if (selectedIds.length === 0) {
                showNotification('Qaimə seçilməyib', 'warning')
                return
              }
              try {
                await Promise.all(selectedIds.map(id => ordersAPI.updateStatus(id.toString(), true)))
                await loadInvoices()
                setSelectedInvoiceIds([])
                showNotification('Qaimələr təsdiq edildi', 'success')
              } catch (err: any) {
                showNotification(err.response?.data?.message || 'Xəta baş verdi', 'error')
              }
            },
            onDeactivate: async (selectedIds: (number | string)[]) => {
              if (selectedIds.length === 0) {
                showNotification('Qaimə seçilməyib', 'warning')
                return
              }
              try {
                await Promise.all(selectedIds.map(id => ordersAPI.updateStatus(id.toString(), false)))
                await loadInvoices()
                setSelectedInvoiceIds([])
                showNotification('Qaimələr təsdiq edilmədi', 'success')
              } catch (err: any) {
                showNotification(err.response?.data?.message || 'Xəta baş verdi', 'error')
              }
            },
          }}
          onSearch={handleSearch}
          activeSearchColumn={currentSearchColumn}
          onActiveSearchColumnChange={setCurrentSearchColumn}
          onColumnHeaderClick={(columnId) => {
            console.log('[Satis.tsx] onColumnHeaderClick callback çağırıldı, columnId:', columnId)
            console.log('[Satis.tsx] lastClickedColumn köhnə dəyər:', lastClickedColumn)
            setLastClickedColumn(columnId)
            console.log('[Satis.tsx] lastClickedColumn yeni dəyər təyin edildi:', columnId)
          }}
          onRowSelect={setSelectedInvoiceIds}
          onRowClick={(_row, id) => {
            // Dubl klik zamanı sənədi aç
            handleEdit([id])
          }}
          leftToolbarItems={[
            <button
              key="refresh"
              onClick={loadInvoices}
              title="Cədvəli yenilə (F5)"
              style={{
                padding: '0.5rem 1rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3V1M8 1L6 3M8 1L10 3M3 8H1M1 8L3 6M1 8L3 10M13 8H15M15 8L13 6M15 8L13 10M8 13V15M8 15L6 13M8 15L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 12C10.2091 12 12 10.2091 12 8C12 5.79086 10.2091 4 8 4C5.79086 4 4 5.79086 4 8C4 10.2091 5.79086 12 8 12Z" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
              Yenilə
            </button>,
            <button
              key="filter"
              onClick={() => setShowFilterModal(true)}
              title="Filtr"
              style={{
                padding: '0.5rem 1rem',
                background: activeFilters.length > 0 ? '#ffc107' : '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4H14M4 8H12M6 12H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Filtr{activeFilters.length > 0 ? ` (${activeFilters.length})` : ''}
            </button>,
            <button
              key="add"
              onClick={async () => {
                await openModalForInvoice(null)
              }}
              title="Yeni qaimə (Insert)"
              style={{
                padding: '0.5rem 1rem',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              ➕ Yeni qaimə
            </button>
          ]}
          rightToolbarItems={[
            <button
              key="activate"
              onClick={async () => {
                if (selectedInvoiceIds.length === 0) {
                  showNotification('Qaimə seçilməyib', 'warning')
                  return
                }
                try {
                  await Promise.all(selectedInvoiceIds.map(id => ordersAPI.updateStatus(id.toString(), true)))
                  await loadInvoices()
                  setSelectedInvoiceIds([])
                  showNotification('Qaimələr təsdiq edildi', 'success')
                } catch (err: any) {
                  showNotification(err.response?.data?.message || 'Xəta baş verdi', 'error')
                }
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
              title="Aktiv et"
            >
              <span style={{ position: 'relative', display: 'inline-block', fontSize: '1.2rem', marginRight: '0.5rem' }}>
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
              Aktiv et
            </button>,
            <button
              key="deactivate"
              onClick={async () => {
                if (selectedInvoiceIds.length === 0) {
                  showNotification('Qaimə seçilməyib', 'warning')
                  return
                }
                try {
                  await Promise.all(selectedInvoiceIds.map(id => ordersAPI.updateStatus(id.toString(), false)))
                  await loadInvoices()
                  setSelectedInvoiceIds([])
                  showNotification('Qaimələr təsdiq edilmədi', 'success')
                } catch (err: any) {
                  showNotification(err.response?.data?.message || 'Xəta baş verdi', 'error')
                }
              }}
              style={{
                padding: '0.5rem 1rem',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
              title="Deaktiv et"
            >
              <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>📄</span>
              Deaktiv et
            </button>
          ]}
        />

        {/* Çoxlu Modallar */}
        {Array.from(openModals.values()).map((modal, index) => (
          <InvoiceModal
            key={modal.id}
            modal={modal}
            customers={customers}
            products={products}
            modalIndex={index}
            isActive={activeModalId === modal.id}
            onActivate={(modalId) => {
              const currentModal = openModals.get(modalId)
              if (currentModal) {
                const windowId = `invoice-modal-${modalId}`
                const newZIndex = baseZIndex + 1
                setBaseZIndex(newZIndex)
                setActiveModalId(modalId)
                setOpenModals(prev => {
                  const newMap = new Map(prev)
                  newMap.set(modalId, { ...currentModal, zIndex: newZIndex })
                  return newMap
                })
                updateWindow(windowId, { zIndex: newZIndex, isVisible: true, isMinimized: false })
              }
            }}
            windowId={`invoice-modal-${modal.id}`}
            onClose={(modalId) => {
              console.log('[Satis.tsx] onClose called with modalId:', modalId)
              const windowId = `invoice-modal-${modalId}`
              console.log('[Satis.tsx] Removing window:', windowId)
              removeWindow(windowId)
              setOpenModals(prev => {
                console.log('[Satis.tsx] Current openModals size:', prev.size)
                const newMap = new Map(prev)
                newMap.delete(modalId)
                console.log('[Satis.tsx] After delete, newMap size:', newMap.size)
                return newMap
              })
              if (activeModalId === modalId) {
                const remainingModals = Array.from(openModals.values()).filter(m => m.id !== modalId)
                if (remainingModals.length > 0) {
                  const topModal = remainingModals.reduce((prev, curr) => 
                    curr.zIndex > prev.zIndex ? curr : prev
                  )
                  console.log('[Satis.tsx] Setting new active modal:', topModal.id)
                  setActiveModalId(topModal.id)
                } else {
                  console.log('[Satis.tsx] No remaining modals, setting activeModalId to null')
                  setActiveModalId(null)
                }
              }
            }}
            onUpdate={(modalId, updates) => {
              setOpenModals(prev => {
                const newMap = new Map(prev)
                const existing = newMap.get(modalId)
                if (existing) {
                  newMap.set(modalId, { ...existing, ...updates })
                }
                return newMap
              })
            }}
            onSave={async (_modalId, modalData) => {
              try {
                // Validasiya - məhsul seçilməlidir
                const validItems = modalData.invoiceItems.filter(item => item.product_id !== null)
                if (validItems.length === 0) {
                  showNotification('Ən azı bir məhsul seçilməlidir', 'warning')
                  return
                }

                if (modal.invoiceId) {
                  // Mövcud qaimə - yenilə
                  await ordersAPI.update(modal.invoiceId.toString(), {
                    customer_id: modalData.selectedCustomerId ?? undefined,
                    items: validItems.map(item => ({
                      product_id: item.product_id!,
                      quantity: item.quantity,
                      unit_price: item.unit_price,
                      total_price: item.total_price,
                    })),
                    notes: modalData.notes || undefined,
                    payment_date: modalData.paymentDate || undefined,
                    invoice_number: modalData.invoiceNumber || undefined,
                    invoice_date: modalData.invoiceDate || undefined,
                  })
                  // Vəziyyəti dəyişdirmə - mövcud vəziyyəti saxla
                  if (modal.isActive !== undefined) {
                    await ordersAPI.updateStatus(modal.invoiceId.toString(), modal.isActive)
                  }
                  showNotification('Qaimə uğurla yeniləndi', 'success')
                } else {
                  // Yeni qaimə - yarad, amma tesdiqsiz saxla
                  const newInvoice = await ordersAPI.create({
                    customer_id: modalData.selectedCustomerId ?? undefined,
                    items: validItems.map(item => ({
                      product_id: item.product_id!,
                      quantity: item.quantity,
                      unit_price: item.unit_price,
                      total_price: item.total_price,
                    })),
                    notes: modalData.notes || undefined,
                    payment_date: modalData.paymentDate || undefined,
                    invoice_number: modalData.invoiceNumber || undefined,
                    is_active: false, // Tesdiqsiz saxla
                  })
                  
                  // Qaimə tarixini formatla (saat, dəqiqə, saniyə ilə)
                  let invoiceDateStr = ''
                  if (newInvoice.invoice_date) {
                    const date = new Date(newInvoice.invoice_date)
                    invoiceDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
                  }
                  
                  // Modalı yenilə - qaimə nömrəsi və tarixi əlavə et
                  setOpenModals(prev => {
                    const newMap = new Map(prev)
                    const currentModal = newMap.get(modal.id)
                    if (currentModal) {
                      newMap.set(modal.id, {
                        ...currentModal,
                        invoiceId: newInvoice.id,
                        isActive: false,
                        data: {
                          ...currentModal.data,
                          invoiceNumber: newInvoice.invoice_number || '',
                          invoiceDate: invoiceDateStr
                        }
                      })
                    }
                    return newMap
                  })
                  
                  showNotification('Qaimə uğurla yaradıldı (təsdiqsiz)', 'success')
                }
                await loadInvoices()
              } catch (err: any) {
                showNotification(err.response?.data?.message || 'Qaimə yadda saxlanarkən xəta baş verdi', 'error')
                throw err // Xətanı yuxarı at ki, modal bağlanmasın
              }
            }}
            onSaveAndConfirm={async (_modalId, modalData) => {
              try {
                // Validasiya - məhsul seçilməlidir
                const validItems = modalData.invoiceItems.filter(item => item.product_id !== null)
                if (validItems.length === 0) {
                  showNotification('Ən azı bir məhsul seçilməlidir', 'warning')
                  return
                }

                const modal = openModals.get(_modalId)
                if (!modal) return

                if (modal.invoiceId) {
                  // Mövcud qaimə - yenilə və təsdiqlə
                  await ordersAPI.update(modal.invoiceId.toString(), {
                    customer_id: modalData.selectedCustomerId ?? undefined,
                    items: validItems.map(item => ({
                      product_id: item.product_id!,
                      quantity: item.quantity,
                      unit_price: item.unit_price,
                      total_price: item.total_price,
                    })),
                    notes: modalData.notes || undefined,
                    payment_date: modalData.paymentDate || undefined,
                    invoice_number: modalData.invoiceNumber || undefined,
                    invoice_date: modalData.invoiceDate || undefined,
                  })
                  // Təsdiqlə
                  await ordersAPI.updateStatus(modal.invoiceId.toString(), true)
                  showNotification('Qaimə uğurla yeniləndi və təsdiq edildi', 'success')
                } else {
                  // Yeni qaimə - yarad və təsdiqlə
                  const newInvoice = await ordersAPI.create({
                    customer_id: modalData.selectedCustomerId ?? undefined,
                    items: validItems.map(item => ({
                      product_id: item.product_id!,
                      quantity: item.quantity,
                      unit_price: item.unit_price,
                      total_price: item.total_price,
                    })),
                    notes: modalData.notes || undefined,
                    payment_date: modalData.paymentDate || undefined,
                    invoice_number: modalData.invoiceNumber || undefined,
                    is_active: true, // Təsdiqlə
                  })
                  
                  // Qaimə tarixini formatla (saat, dəqiqə, saniyə ilə)
                  let invoiceDateStr = ''
                  if (newInvoice.invoice_date) {
                    const date = new Date(newInvoice.invoice_date)
                    invoiceDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
                  }
                  
                  // Modalı yenilə - qaimə nömrəsi və tarixi əlavə et
                  setOpenModals(prev => {
                    const newMap = new Map(prev)
                    const currentModal = newMap.get(modal.id)
                    if (currentModal) {
                      newMap.set(modal.id, {
                        ...currentModal,
                        invoiceId: newInvoice.id,
                        isActive: true,
                        data: {
                          ...currentModal.data,
                          invoiceNumber: newInvoice.invoice_number || '',
                          invoiceDate: invoiceDateStr
                        }
                      })
                    }
                    return newMap
                  })
                  
                  showNotification('Qaimə uğurla yaradıldı və təsdiq edildi', 'success')
                }
                await loadInvoices()
              } catch (err: any) {
                showNotification(err.response?.data?.message || 'Qaimə yadda saxlanarkən xəta baş verdi', 'error')
                throw err // Xətanı yuxarı at ki, modal bağlanmasın
              }
            }}
            onPrint={async (modalId, _modalData) => {
              const modal = openModals.get(modalId)
              if (!modal || !modal.invoiceId) {
                showNotification('Yalnız mövcud qaimələr çap edilə bilər', 'warning')
                return
              }

              try {
                const fullInvoice = await ordersAPI.getById(modal.invoiceId.toString())
                const printWindow = window.open('', '_blank')
                if (printWindow) {
                  const invoiceDate = fullInvoice.invoice_date ? new Date(fullInvoice.invoice_date).toLocaleDateString('az-AZ') : '-'
                  const items = fullInvoice.sale_invoice_items || []
                  const totalAmount = fullInvoice.total_amount ? Number(fullInvoice.total_amount) : 0

                  let htmlContent = `
                    <html>
                      <head>
                        <title>Satış Qaiməsi</title>
                        <style>
                          body { font-family: Arial, sans-serif; padding: 20px; }
                          .invoice { border: 1px solid #ddd; padding: 20px; }
                          .invoice-header { text-align: center; margin-bottom: 20px; }
                          .invoice-header h2 { margin: 0; }
                          .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; }
                          .invoice-info div { flex: 1; }
                          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                          th { background-color: #f2f2f2; }
                          .total-row { font-weight: bold; background-color: #f9f9f9; }
                          .text-right { text-align: right; }
                        </style>
                      </head>
                      <body>
                        <div class="invoice">
                          <div class="invoice-header">
                            <h2>SATIŞ QAIMƏSİ</h2>
                          </div>
                          <div class="invoice-info">
                            <div>
                              <p><strong>Faktura №:</strong> ${fullInvoice.invoice_number || ''}</p>
                              <p><strong>Tarix:</strong> ${invoiceDate}</p>
                            </div>
                            <div>
                              <p><strong>Müştəri:</strong> ${fullInvoice.customers?.name || '-'}</p>
                              ${fullInvoice.customers?.phone ? `<p><strong>Telefon:</strong> ${fullInvoice.customers.phone}</p>` : ''}
                            </div>
                          </div>
                          <table>
                            <thead>
                              <tr>
                                <th>№</th>
                                <th>Məhsul</th>
                                <th class="text-right">Miqdar</th>
                                <th class="text-right">Vahid qiymət</th>
                                <th class="text-right">Cəmi</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${items.map((item: any, idx: number) => `
                                <tr>
                                  <td>${idx + 1}</td>
                                  <td>${item.products?.name || 'Naməlum məhsul'}</td>
                                  <td class="text-right">${item.quantity}</td>
                                  <td class="text-right">${Number(item.unit_price).toFixed(2)} ₼</td>
                                  <td class="text-right">${Number(item.total_price).toFixed(2)} ₼</td>
                                </tr>
                              `).join('')}
                            </tbody>
                            <tfoot>
                              <tr class="total-row">
                                <td colspan="4" class="text-right"><strong>Ümumi:</strong></td>
                                <td class="text-right"><strong>${totalAmount.toFixed(2)} ₼</strong></td>
                              </tr>
                            </tfoot>
                          </table>
                          ${fullInvoice.notes ? `<p style="margin-top: 20px;"><strong>Qeydlər:</strong> ${fullInvoice.notes}</p>` : ''}
                        </div>
                      </body>
                    </html>
                  `
                  printWindow.document.write(htmlContent)
                  printWindow.document.close()
                  printWindow.print()
                }
              } catch (err: any) {
                showNotification(err.response?.data?.message || 'Qaimə çap edilərkən xəta baş verdi', 'error')
              }
            }}
          />
        ))}
        
        {/* Boşluğa klik edəndə aktiv modalı arxaya göndər */}
        {openModals.size > 0 && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 500,
              pointerEvents: 'auto',
            }}
            onClick={(e) => {
              const target = e.target as HTMLElement
              if (!target.closest('[data-modal-container]')) {
                if (activeModalId) {
                  const currentModal = openModals.get(activeModalId)
                  if (currentModal) {
                    const minZIndex = Math.min(...Array.from(openModals.values()).map(m => m.zIndex))
                    const newZIndex = minZIndex - 1
                    setOpenModals(prev => {
                      const newMap = new Map(prev)
                      newMap.set(activeModalId, { ...currentModal, zIndex: newZIndex })
                      return newMap
                    })
                    setActiveModalId(null)
                  }
                }
              }
            }}
          />
        )}

        {/* Yeni Qaimə Modal (köhnə sistem) */}
        {showModal && (() => {
          // Store-dan modalın z-index və isVisible məlumatlarını götür
          const windowInfo = windows.get('old-invoice-modal')
          if (!windowInfo) {
            return null // Store-da yoxdursa göstərmə
          }
          
          const modalZIndex = windowInfo.zIndex || 1000
          const storeIsMinimized = windowInfo.isMinimized || false
          const storeIsVisible = windowInfo.isVisible && !storeIsMinimized
          const storePosition = windowInfo.position
          const storeSize = windowInfo.size
          const storeIsMaximized = windowInfo.isMaximized || false
          
          // Store-dan mövqe və ölçü varsa istifadə et
          const currentPosition = storePosition || modalPosition
          const currentSize = storeSize || modalSize
          const currentIsMaximized = storeIsMaximized
          
          // Store-dan state-i oxu, local state-dən deyil
          if (!storeIsVisible) {
            return null // Store-da görünmürsə göstərmə
          }
          
          return (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                zIndex: modalZIndex,
              }}
              onClick={(e) => {
                // Boşluğa klikləyəndə modalı bağlama, yalnız arxaya göndər
                const target = e.target as HTMLElement
                if (target === e.currentTarget) {
                  console.log('[DEBUG] Boşluğa klikləndi - modalı arxaya göndəririk')
                  const currentWindow = windows.get('old-invoice-modal')
                  if (currentWindow) {
                    // Bütün görünən modalları tap (həm köhnə sistem, həm də yeni sistem)
                    const allVisibleWindows = Array.from(windows.values())
                      .filter(w => w.isVisible && !w.isMinimized && w.id !== 'old-invoice-modal')
                    const openModalsCount = Array.from(openModals.values()).length
                    
                    console.log('[DEBUG] Görünən modallar:', allVisibleWindows.length, 'Açıq modallar (yeni sistem):', openModalsCount)
                    
                    if (allVisibleWindows.length > 0 || openModalsCount > 0) {
                      const minZIndex = allVisibleWindows.length > 0 
                        ? Math.min(...allVisibleWindows.map(w => w.zIndex))
                        : currentWindow.zIndex - 100
                      const newZIndex = minZIndex - 1
                      console.log('[DEBUG] Yeni z-index:', newZIndex, 'Köhnə:', currentWindow.zIndex, 'Digər modallar:', allVisibleWindows.length)
                      updateWindow('old-invoice-modal', { zIndex: newZIndex })
                    } else {
                      // Digər modallar yoxdursa, sadəcə z-index-i azalt
                      const newZIndex = currentWindow.zIndex - 100
                      console.log('[DEBUG] Digər modallar yoxdur, z-index azaldı:', newZIndex)
                      updateWindow('old-invoice-modal', { zIndex: newZIndex })
                    }
                  } else {
                    console.log('[DEBUG] Modal store-da tapılmadı')
                  }
                }
              }}
            >
            <div
              style={{
                position: 'absolute',
                left: currentIsMaximized ? 0 : `${currentPosition.x}px`,
                top: currentIsMaximized ? 0 : `${currentPosition.y}px`,
                width: currentIsMaximized ? '100%' : `${currentSize.width}px`,
                height: currentIsMaximized ? '100%' : `${currentSize.height}px`,
                background: 'white',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal başlığı - drag üçün */}
              <div
                className="modal-header"
                onMouseDown={handleModalMouseDown}
                style={{
                  padding: '1rem',
                  borderBottom: '1px solid #ddd',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  background: '#f8f9fa',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  userSelect: 'none',
                }}
              >
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
                  {editingInvoiceId ? 'Qaiməni Redaktə Et' : 'Yeni Satış Qaiməsi'}
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={handleMinimize}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '1.2rem',
                      cursor: 'pointer',
                      padding: '0.25rem 0.5rem',
                      lineHeight: 1,
                      color: '#666',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                    }}
                    title="Kiçilt"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#e9ecef'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    −
                  </button>
                  <button
                    onClick={handleMaximize}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      padding: '0.25rem 0.5rem',
                      lineHeight: 1,
                      color: '#666',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                    }}
                    title={isMaximized ? "Bərpa et" : "Böyüt"}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#e9ecef'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    {isMaximized ? '⧉' : '□'}
                  </button>
                  <button
                    onClick={handleCloseModal}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                      padding: '0.25rem 0.5rem',
                      lineHeight: 1,
                      color: '#666',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '28px',
                      height: '28px',
                      borderRadius: '4px',
                    }}
                    title="Bağla"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#dc3545'
                      e.currentTarget.style.color = 'white'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = '#666'
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
              
              {/* Modal məzmunu */}
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  padding: '1.5rem',
                }}
              >

              {/* Müştəri seçimi */}
              <div style={{ marginBottom: '1rem', position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Müştəri
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Müştəri adını yazın... (F4 - siyahı)"
                      value={selectedCustomer ? selectedCustomer.name : customerSearchTerm}
                      data-customer-input="true"
                      onChange={(e) => {
                        const value = e.target.value
                        setCustomerSearchTerm(value)
                        setShowCustomerDropdown(value.length > 0)
                        if (!value) {
                          setSelectedCustomerId(null)
                          setSelectedCustomer(null)
                          setShowCustomerDropdown(false)
                        }
                      }}
                      onFocus={() => {
                        if (customerSearchTerm && !selectedCustomer) {
                          setShowCustomerDropdown(true)
                        }
                      }}
                      onBlur={() => {
                        // Dropdown-u gizlət, amma kiçik gecikmə ilə ki, click işləsin
                        setTimeout(() => setShowCustomerDropdown(false), 200)
                      }}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        fontSize: '1rem'
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
                              setSelectedCustomerId(customer.id)
                              setSelectedCustomer(customer)
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
                  <button
                    type="button"
                    onClick={() => setShowCustomerModal(true)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '1rem'
                    }}
                    title="Müştərilər siyahısı"
                  >
                    📁
                  </button>
                  {selectedCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(null)
                        setSelectedCustomer(null)
                        setCustomerSearchTerm('')
                        setShowCustomerDropdown(false)
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
                {selectedCustomer && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#e7f3ff', borderRadius: '4px', fontSize: '0.875rem' }}>
                    <strong>{selectedCustomer.name}</strong>
                    {selectedCustomer.phone && <span> - {selectedCustomer.phone}</span>}
                  </div>
                )}
              </div>

              {/* Qaimə tarixi və nömrəsi */}
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
                {/* Qaimə tarixi */}
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                    Qaimə tarixi
                  </label>
                  <input
                    type="datetime-local"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    step="1"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
                {/* Qaimə nömrəsi */}
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                    Qaimə nömrəsi
                  </label>
                  <input
                    type="text"
                    placeholder="Qaimə nömrəsini daxil edin..."
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>

              {/* Ödəniş tarixi */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Son ödəniş tarixi
                </label>
                <input
                  type="text"
                  placeholder="15, 15.11 və ya 15.11.2025 formatında daxil edin..."
                  value={paymentDate}
                  onChange={(e) => {
                    const value = e.target.value
                    setPaymentDate(value)
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const value = e.currentTarget.value.trim()
                      if (value) {
                        const formatted = formatDateInput(value)
                        if (formatted) {
                          setPaymentDate(formatted)
                        }
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.trim()
                    if (value) {
                      const formatted = formatDateInput(value)
                      if (formatted) {
                        setPaymentDate(formatted)
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem'
                  }}
                />
              </div>


              {/* Məhsul siyahısı - həmişə görünən */}
              <div style={{ marginBottom: '1.5rem', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ background: '#f8f9fa', padding: '0.75rem', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 'bold' }}>Məhsullar və xidmətlər ({invoiceItems.length})</div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={handleAddEmptyRow}
                      style={{
                        padding: '0.5rem',
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}
                      title="Əlavə et"
                    >
                      ➕ Əlavə et
                    </button>
                    <button
                      onClick={handleCopySelectedItems}
                      disabled={selectedItemIndices.length === 0}
                      style={{
                        padding: '0.5rem',
                        background: selectedItemIndices.length === 0 ? '#ccc' : '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: selectedItemIndices.length === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '1rem'
                      }}
                      title="Kopyala"
                    >
                      📋
                    </button>
                    <button
                      onClick={handleRemoveSelectedItems}
                      disabled={selectedItemIndices.length === 0}
                      style={{
                        padding: '0.5rem',
                        background: selectedItemIndices.length === 0 ? '#ccc' : '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: selectedItemIndices.length === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '1rem'
                      }}
                      title="Sil"
                    >
                      🗑️
                    </button>
                    <button
                      onClick={handleMoveItemUp}
                      disabled={selectedItemIndices.length !== 1 || selectedItemIndices[0] === 0}
                      style={{
                        padding: '0.5rem',
                        background: (selectedItemIndices.length !== 1 || selectedItemIndices[0] === 0) ? '#ccc' : '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (selectedItemIndices.length !== 1 || selectedItemIndices[0] === 0) ? 'not-allowed' : 'pointer',
                        fontSize: '1rem'
                      }}
                      title="Yuxarı"
                    >
                      ⬆️
                    </button>
                    <button
                      onClick={handleMoveItemDown}
                      disabled={selectedItemIndices.length !== 1 || selectedItemIndices[0] === invoiceItems.length - 1}
                      style={{
                        padding: '0.5rem',
                        background: (selectedItemIndices.length !== 1 || selectedItemIndices[0] === invoiceItems.length - 1) ? '#ccc' : '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (selectedItemIndices.length !== 1 || selectedItemIndices[0] === invoiceItems.length - 1) ? 'not-allowed' : 'pointer',
                        fontSize: '1rem'
                      }}
                      title="Aşağı"
                    >
                      ⬇️
                    </button>
                    <button
                      onClick={() => setShowItemSettingsModal(true)}
                      style={{
                        padding: '0.5rem',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '1rem'
                      }}
                      title="Ayarlar"
                    >
                      ⚙️
                    </button>
                    <button
                      onClick={() => setShowProductModal(true)}
                      style={{
                        padding: '0.5rem',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '1rem'
                      }}
                      title="Məhsullar siyahısı"
                    >
                      📁
                    </button>
                  </div>
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 10 }}>
                        <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center', fontSize: '0.875rem', width: '40px' }}>
                          <input
                            type="checkbox"
                            checked={selectedItemIndices.length === invoiceItems.length && invoiceItems.length > 0}
                            onChange={handleSelectAllItems}
                            style={{ cursor: 'pointer' }}
                          />
                        </th>
                        {itemTableColumns.showNumber && (
                          <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left', fontSize: '0.875rem' }}>№</th>
                        )}
                        {itemTableColumns.showProduct && (
                          <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left', fontSize: '0.875rem' }}>Məhsul</th>
                        )}
                        {itemTableColumns.showQuantity && (
                          <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.875rem' }}>Miqdar</th>
                        )}
                        {itemTableColumns.showUnitPrice && (
                          <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.875rem' }}>Vahid qiymət</th>
                        )}
                        {itemTableColumns.showTotal && (
                          <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.875rem' }}>Cəm</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.length === 0 ? (
                        <tr>
                          <td colSpan={1 + Object.values(itemTableColumns).filter(v => v).length} style={{ padding: '2rem', textAlign: 'center', color: '#999', fontStyle: 'italic' }}>
                            Məhsul əlavə edilməyib
                          </td>
                        </tr>
                      ) : (
                        invoiceItems.map((item, index) => {
                          const rowProducts = getFilteredProductsForRow(item.searchTerm || '')
                          const isSelected = selectedItemIndices.includes(index)
                          return (
                            <tr 
                              key={index} 
                              onClick={(e) => {
                                // Checkbox-a klikləyəndə işləməsin
                                if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'BUTTON') {
                                  handleToggleItemSelection(index)
                                }
                              }}
                              style={{ 
                                background: isSelected ? '#e7f3ff' : (index % 2 === 0 ? 'white' : '#f9f9f9'),
                                cursor: 'pointer'
                              }}
                            >
                              <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleItemSelection(index)}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{ cursor: 'pointer' }}
                                />
                              </td>
                              {itemTableColumns.showNumber && (
                                <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center' }}>{index + 1}</td>
                              )}
                              {itemTableColumns.showProduct && (
                                <td style={{ padding: '0.75rem', border: '1px solid #ddd', position: 'relative' }}>
                                {item.product_id ? (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{item.product_name}</span>
                                    <button
                                      onClick={() => {
                                        const updatedItems = [...invoiceItems]
                                        updatedItems[index] = {
                                          ...updatedItems[index],
                                          product_id: null,
                                          product_name: '',
                                          searchTerm: ''
                                        }
                                        setInvoiceItems(updatedItems)
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
                                      title="Məhsulu sil"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ position: 'relative' }}>
                                    <input
                                      type="text"
                                      placeholder="Məhsul adını yazın... (F4 - siyahı)"
                                      value={item.searchTerm || ''}
                                      data-product-row-input="true"
                                      data-row-index={index.toString()}
                                      onChange={(e) => handleProductSearchInRow(index, e.target.value)}
                                      onFocus={() => {
                                        if (!item.searchTerm) {
                                          handleProductSearchInRow(index, '')
                                        }
                                      }}
                                      onBlur={(e) => {
                                        // Dropdown-a klikləyəndə bağlanmasın
                                        setTimeout(() => {
                                          const relatedTarget = e.relatedTarget as HTMLElement
                                          if (!relatedTarget || !relatedTarget.closest('.product-dropdown')) {
                                            const updatedItems = [...invoiceItems]
                                            updatedItems[index] = {
                                              ...updatedItems[index],
                                              searchTerm: ''
                                            }
                                            setInvoiceItems(updatedItems)
                                          }
                                        }, 200)
                                      }}
                                      onClick={(e) => e.stopPropagation()}
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
                                              handleProductSelectInRow(index, product.id)
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
                                            {product.sale_price && (
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
                              )}
                              {itemTableColumns.showQuantity && (
                                <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={item.quantity}
                                    onChange={(e) => handleUpdateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                    style={{
                                      width: '100px',
                                      padding: '0.25rem',
                                      border: '1px solid #ddd',
                                      borderRadius: '4px',
                                      textAlign: 'right',
                                      fontSize: '0.9rem'
                                    }}
                                  />
                                </td>
                              )}
                              {itemTableColumns.showUnitPrice && (
                                <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right' }}>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.unit_price}
                                    onChange={(e) => handleUpdateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                    style={{
                                      width: '120px',
                                      padding: '0.25rem',
                                      border: '1px solid #ddd',
                                      borderRadius: '4px',
                                      textAlign: 'right',
                                      fontSize: '0.9rem'
                                    }}
                                  />
                                </td>
                              )}
                              {itemTableColumns.showTotal && (
                                <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold' }}>{item.total_price.toFixed(2)} ₼</td>
                              )}
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                    {invoiceItems.length > 0 && (
                      <tfoot>
                        <tr style={{ background: '#e7f3ff', fontWeight: 'bold' }}>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}></td>
                          {itemTableColumns.showNumber && <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}></td>}
                          {itemTableColumns.showProduct && <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}></td>}
                          {itemTableColumns.showQuantity && <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}></td>}
                          {(() => {
                            const visibleColumns = [
                              itemTableColumns.showNumber,
                              itemTableColumns.showProduct,
                              itemTableColumns.showQuantity,
                              itemTableColumns.showUnitPrice,
                              itemTableColumns.showTotal
                            ].filter(v => v).length
                            const colspanBeforeTotal = visibleColumns - (itemTableColumns.showTotal ? 1 : 0)
                            return (
                              <>
                                {itemTableColumns.showUnitPrice && (
                                  <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right' }}>Ümumi məbləğ:</td>
                                )}
                                {itemTableColumns.showTotal && (
                                  <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right' }}>{totalAmount.toFixed(2)} ₼</td>
                                )}
                                {!itemTableColumns.showUnitPrice && !itemTableColumns.showTotal && (
                                  <td colSpan={colspanBeforeTotal} style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right' }}>Ümumi məbləğ: {totalAmount.toFixed(2)} ₼</td>
                                )}
                                {!itemTableColumns.showUnitPrice && itemTableColumns.showTotal && (
                                  <>
                                    <td colSpan={colspanBeforeTotal} style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right' }}>Ümumi məbləğ:</td>
                                    <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right' }}>{totalAmount.toFixed(2)} ₼</td>
                                  </>
                                )}
                              </>
                            )
                          })()}
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Qeydlər */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Qeydlər
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {/* Düymələr */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={handleCloseModal}
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
                  Ləğv et
                </button>
                <button
                  onClick={handleSaveWithoutConfirm}
                  style={{
                    padding: '0.5rem 1.5rem',
                    background: '#17a2b8',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  Yadda saxla
                </button>
                <button
                  onClick={handleOk}
                  style={{
                    padding: '0.5rem 1.5rem',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 'bold'
                  }}
                >
                  OK
                </button>
              </div>
              </div>
              
              {/* Resize handle - sağ alt künc (yalnız maximize olmadıqda görünür) */}
              {!isMaximized && (
                <div
                  onMouseDown={handleModalResizeMouseDown}
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
        })()}

        {/* Müştəri Modal */}
        {showCustomerModal && (
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
              zIndex: 2000,
            }}
            onClick={() => {
              setShowCustomerModal(false)
              setCustomerModalSearchTerm('')
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '2rem',
                maxWidth: '900px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Müştəri seçin</h2>
              <input
                type="text"
                placeholder="Müştəri adını, telefonunu və ya email-ini yazın..."
                value={customerModalSearchTerm}
                onChange={(e) => setCustomerModalSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  marginBottom: '1rem'
                }}
                autoFocus
              />
              <div style={{ maxHeight: '500px', overflow: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                {filteredCustomersForModal.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>Müştəri tapılmadı</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left' }}>Ad</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left' }}>Telefon</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left' }}>Email</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left' }}>Ünvan</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #ddd', width: '120px' }}>Əməliyyat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomersForModal.map(customer => (
                        <tr
                          key={customer.id}
                          style={{
                            background: selectedCustomerId === customer.id ? '#e7f3ff' : 'white',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            if (selectedCustomerId !== customer.id) {
                              e.currentTarget.style.background = '#f8f9fa'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedCustomerId !== customer.id) {
                              e.currentTarget.style.background = 'white'
                            }
                          }}
                        >
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd', fontWeight: 'bold' }}>{customer.name}</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{customer.phone || '-'}</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{customer.email || '-'}</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{customer.address || '-'}</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                setSelectedCustomerId(customer.id)
                                setSelectedCustomer(customer)
                                setShowCustomerModal(false)
                                setCustomerModalSearchTerm('')
                                setCustomerSearchTerm('')
                              }}
                              style={{
                                padding: '0.5rem 1rem',
                                background: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: 'bold'
                              }}
                            >
                              Əlavə et
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <button
                onClick={() => {
                  setShowCustomerModal(false)
                  setCustomerModalSearchTerm('')
                }}
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem 1.5rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  width: '100%'
                }}
              >
                Bağla
              </button>
            </div>
          </div>
        )}

        {/* Məhsul Modal */}
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
              zIndex: 2000,
            }}
            onClick={() => {
              setShowProductModal(false)
              setProductModalSearchTerm('')
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '2rem',
                maxWidth: '1000px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Məhsul seçin</h2>
              <input
                type="text"
                placeholder="Məhsul adını, kodunu və ya barkodunu yazın..."
                value={productModalSearchTerm}
                onChange={(e) => setProductModalSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  marginBottom: '1rem'
                }}
                autoFocus
              />
              <div style={{ maxHeight: '500px', overflow: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                {filteredProductsForModal.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>Məhsul tapılmadı</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left' }}>Ad</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left' }}>Kod</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left' }}>Barkod</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right' }}>Satış qiyməti</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left' }}>Yararlılıq</th>
                        <th style={{ padding: '0.75rem', border: '1px solid #ddd', width: '120px' }}>Əməliyyat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProductsForModal.map(product => (
                        <tr
                          key={product.id}
                          style={{
                            background: selectedProductId === product.id ? '#e7f3ff' : 'white',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            if (selectedProductId !== product.id) {
                              e.currentTarget.style.background = '#f8f9fa'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (selectedProductId !== product.id) {
                              e.currentTarget.style.background = 'white'
                            }
                          }}
                        >
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd', fontWeight: 'bold' }}>{product.name}</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{product.code || '-'}</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{product.barcode || '-'}</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold', color: '#28a745' }}>
                            {product.sale_price ? `${Number(product.sale_price).toFixed(2)} ₼` : '-'}
                          </td>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd', fontSize: '0.875rem' }}>
                            {product.production_date && product.expiry_date ? (
                              <div>
                                <div style={{ color: '#007bff' }}>
                                  {formatDateDifference(
                                    new Date(product.production_date),
                                    new Date(product.expiry_date)
                                  )}
                                </div>
                                {(() => {
                                  const today = new Date()
                                  today.setHours(0, 0, 0, 0)
                                  const expiryDate = new Date(product.expiry_date)
                                  expiryDate.setHours(0, 0, 0, 0)
                                  const diff = calculateDaysDifference(today, expiryDate)
                                  if (diff < 0) {
                                    return <div style={{ color: '#dc3545', fontSize: '0.75rem' }}>⚠️ {Math.abs(diff)} gün keçib</div>
                                  } else if (diff === 0) {
                                    return <div style={{ color: '#dc3545', fontSize: '0.75rem' }}>⚠️ Bu gün bitir</div>
                                  } else {
                                    return <div style={{ color: '#28a745', fontSize: '0.75rem' }}>{diff} gün qalıb</div>
                                  }
                                })()}
                              </div>
                            ) : '-'}
                          </td>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                const rowIndexStr = sessionStorage.getItem('selectedProductRowIndex')
                                if (rowIndexStr !== null) {
                                  // Cədvəldəki sətirə məhsul əlavə et
                                  const rowIndex = parseInt(rowIndexStr)
                                  handleProductSelectInRow(rowIndex, product.id)
                                  sessionStorage.removeItem('selectedProductRowIndex')
                                } else {
                                  // Köhnə funksionallıq (modal içindəki məhsul seçimi)
                                  handleProductChange(product.id)
                                }
                                setShowProductModal(false)
                                setProductModalSearchTerm('')
                                setProductSearchTerm('')
                              }}
                              style={{
                                padding: '0.5rem 1rem',
                                background: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: 'bold'
                              }}
                            >
                              Əlavə et
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <button
                onClick={() => {
                  setShowProductModal(false)
                  setProductModalSearchTerm('')
                }}
                style={{
                  marginTop: '1rem',
                  padding: '0.5rem 1.5rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  width: '100%'
                }}
              >
                Bağla
              </button>
            </div>
          </div>
        )}

        {/* Məhsul cədvəli ayarları modalı */}
        {showItemSettingsModal && (
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
              zIndex: 2000,
            }}
            onClick={() => setShowItemSettingsModal(false)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '2rem',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Cədvəl ayarları</h2>
              
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>Sütunları göstər/gizlət</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={itemTableColumns.showNumber}
                      onChange={(e) => setItemTableColumns({ ...itemTableColumns, showNumber: e.target.checked })}
                    />
                    <span>№</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={itemTableColumns.showProduct}
                      onChange={(e) => setItemTableColumns({ ...itemTableColumns, showProduct: e.target.checked })}
                    />
                    <span>Məhsul</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={itemTableColumns.showQuantity}
                      onChange={(e) => setItemTableColumns({ ...itemTableColumns, showQuantity: e.target.checked })}
                    />
                    <span>Miqdar</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={itemTableColumns.showUnitPrice}
                      onChange={(e) => setItemTableColumns({ ...itemTableColumns, showUnitPrice: e.target.checked })}
                    />
                    <span>Vahid qiymət</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={itemTableColumns.showTotal}
                      onChange={(e) => setItemTableColumns({ ...itemTableColumns, showTotal: e.target.checked })}
                    />
                    <span>Cəm</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '2rem' }}>
                <button
                  onClick={() => setShowItemSettingsModal(false)}
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

        {/* Bildirişlər - taskbarın üstündə */}
        {notifications.length > 0 && (
          <div
            style={{
              position: 'fixed',
              bottom: '60px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10001,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            {notifications.map((notification) => {
              const bgColor = {
                success: '#28a745',
                error: '#dc3545',
                warning: '#ffc107',
                info: '#17a2b8'
              }[notification.type]
              
              const textColor = notification.type === 'warning' ? '#000' : '#fff'
              
              return (
                <div
                  key={notification.id}
                  onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
                  style={{
                    background: bgColor,
                    color: textColor,
                    padding: '12px 20px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    minWidth: '250px',
                    maxWidth: '500px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    animation: 'slideUp 0.3s ease-out',
                    border: '1px solid rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <span>
                    {notification.type === 'success' && '✓'}
                    {notification.type === 'error' && '✕'}
                    {notification.type === 'warning' && '⚠'}
                    {notification.type === 'info' && 'ℹ'}
                  </span>
                  <span>{notification.message}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Filtr modalı */}
        <FilterModal
          isOpen={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          title="Filtr"
          columns={[
            { id: 'customer_id', label: 'Müştəri', type: 'select' },
            { id: 'invoice_number', label: 'Faktura №', type: 'text' },
            { id: 'total_amount', label: 'Ümumi məbləğ', type: 'number' },
            { id: 'id', label: 'ID', type: 'number' },
            { id: 'product_id', label: 'Məhsul', type: 'multiselect', options: products.map(p => ({ id: p.id, label: p.name })) },
          ]}
          customers={customers}
          onApply={(filters) => {
            setActiveFilters(filters)
            setShowFilterModal(false)
          }}
          onClear={() => {
            setActiveFilters([])
            setShowFilterModal(false)
          }}
        />
      </Layout>
    </ProtectedRoute>
  )
}
