import { useState, useEffect, useCallback } from 'react'
import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'
import DataTable, { ColumnConfig } from '../../components/DataTable'
import InvoiceModal, { type ModalData, type InvoiceItem } from '../../components/InvoiceModal'
import { purchaseInvoicesAPI, productsAPI, suppliersAPI } from '../../services/api'
import type { PurchaseInvoice, Product, Supplier } from '@shared/types'
import { useWindowStore } from '../../store/windowStore'

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
  { id: 'supplier_name', label: 'Təchizatçı', visible: true, width: 200, order: 4 },
  { id: 'invoice_date', label: 'Tarix', visible: true, width: 120, order: 5 },
  { id: 'total_amount', label: 'Ümumi məbləğ', visible: true, width: 150, order: 6, align: 'right' },
  { id: 'notes', label: 'Qeydlər', visible: true, width: 200, order: 7 },
  { id: 'created_at', label: 'Yaradılma tarixi', visible: false, width: 150, order: 8 },
]

export default function AlisQaimeleri() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredInvoices, setFilteredInvoices] = useState<PurchaseInvoice[]>([])
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<(number | string)[]>([])
  
  // Çoxlu modal state - Windows benzeri sistem
  const [openModals, setOpenModals] = useState<Map<string, ModalData>>(new Map())
  const [activeModalId, setActiveModalId] = useState<string | null>(null)
  const [baseZIndex, setBaseZIndex] = useState(1000)
  
  // Global window store
  const { windows, addWindow, removeWindow, updateWindow } = useWindowStore()
  
  // Data state
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  
  // Köhnə modal state (backward compatibility - istifadə olunmur, amma silməyək)
  const [showModal, setShowModal] = useState(false)
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showItemSettingsModal, setShowItemSettingsModal] = useState(false)
  
  // Pəncərələri izlə və global store-a əlavə et
  useEffect(() => {
    // Qaimə modalları - global store-a əlavə et
    Array.from(openModals.values()).forEach(modal => {
      const windowId = `purchase-invoice-modal-${modal.id}`
      const store = useWindowStore.getState()
      const existingWindow = store.windows.get(windowId)
      
      if (!existingWindow) {
        addWindow({
          id: windowId,
          title: modal.invoiceId ? `Qaimə #${modal.invoiceId}` : 'Yeni Alış Qaiməsi',
          type: 'modal',
          modalType: 'invoice-edit',
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
            removeWindow(windowId)
          }
        })
      } else {
        const storeWindow = existingWindow
        const storeIsMinimized = storeWindow.isMinimized || false
        const expectedIsVisible = !storeIsMinimized
        
        const zIndexChanged = storeWindow.zIndex !== modal.zIndex
        const positionChanged = storeWindow.position?.x !== modal.position.x || storeWindow.position?.y !== modal.position.y
        const sizeChanged = storeWindow.size?.width !== modal.size.width || storeWindow.size?.height !== modal.size.height
        const needsUpdate = 
          zIndexChanged ||
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
      .filter(w => w.id.startsWith('purchase-invoice-modal-'))
      .forEach(window => {
        const modalId = window.id.replace('purchase-invoice-modal-', '')
        if (!openModals.has(modalId)) {
          removeWindow(window.id)
        }
      })
    
    // Köhnə modal sistemi (backward compatibility)
    const existingInvoiceWindow = useWindowStore.getState().windows.get('invoice-modal')
    if (showModal) {
      if (!existingInvoiceWindow) {
        addWindow({
          id: 'invoice-modal',
          title: editingInvoiceId ? 'Qaiməni Redaktə Et' : 'Yeni Alış Qaiməsi',
          type: 'modal',
          modalType: 'invoice-edit',
          isVisible: showModal,
          isMinimized: false,
          zIndex: 1000,
          onActivate: () => {
            setShowModal(true)
          },
          onClose: () => {
            setShowModal(false)
            setEditingInvoiceId(null)
            removeWindow('invoice-modal')
          }
        })
      } else {
        useWindowStore.getState().updateWindow('invoice-modal', {
          isVisible: showModal,
          title: editingInvoiceId ? 'Qaiməni Redaktə Et' : 'Yeni Alış Qaiməsi'
        })
      }
    } else {
      if (existingInvoiceWindow) {
        useWindowStore.getState().updateWindow('invoice-modal', { isVisible: false })
      }
    }
    
    // Təchizatçı modalı
    const existingSupplierWindow = useWindowStore.getState().windows.get('supplier-modal')
    if (showSupplierModal) {
      if (!existingSupplierWindow) {
        addWindow({
          id: 'supplier-modal',
          title: 'Təchizatçı seçin',
          type: 'modal',
          modalType: 'supplier',
          isVisible: showSupplierModal,
          isMinimized: false,
          zIndex: 2000,
          onActivate: () => {
            setShowSupplierModal(true)
          },
          onClose: () => {
            setShowSupplierModal(false)
            removeWindow('supplier-modal')
          }
        })
      } else {
        useWindowStore.getState().updateWindow('supplier-modal', { isVisible: showSupplierModal })
      }
    } else {
      if (existingSupplierWindow) {
        useWindowStore.getState().updateWindow('supplier-modal', { isVisible: false })
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
            removeWindow('product-modal')
          }
        })
      } else {
        useWindowStore.getState().updateWindow('product-modal', { isVisible: showProductModal })
      }
    } else {
      if (existingProductWindow) {
        useWindowStore.getState().updateWindow('product-modal', { isVisible: false })
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
        useWindowStore.getState().updateWindow('item-settings-modal', { isVisible: showItemSettingsModal })
      }
    } else {
      if (existingSettingsWindow) {
        useWindowStore.getState().updateWindow('item-settings-modal', { isVisible: false })
      }
    }
  }, [openModals, baseZIndex, activeModalId, showModal, editingInvoiceId, showSupplierModal, showProductModal, showItemSettingsModal, addWindow, removeWindow, updateWindow])
  
  useEffect(() => {
    loadInvoices()
    loadSuppliers()
    loadProducts()
  }, [])

  useEffect(() => {
    filterInvoices()
  }, [searchTerm, invoices])

  const loadInvoices = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await purchaseInvoicesAPI.getAll()
      setInvoices(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Qaimələr yüklənərkən xəta baş verdi')
    } finally {
      setLoading(false)
    }
  }

  const loadSuppliers = async () => {
    try {
      const data = await suppliersAPI.getAll()
      setSuppliers(data)
    } catch (err: any) {
      console.error('Təchizatçılar yüklənərkən xəta:', err)
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

  const filterInvoices = () => {
    if (!searchTerm.trim()) {
      setFilteredInvoices(invoices)
      return
    }

    const term = searchTerm.toLowerCase()
    const filtered = invoices.filter(invoice => {
      return (
        invoice.invoice_number?.toLowerCase().includes(term) ||
        invoice.suppliers?.name?.toLowerCase().includes(term) ||
        invoice.notes?.toLowerCase().includes(term) ||
        invoice.total_amount?.toString().includes(term)
      )
    })
    setFilteredInvoices(filtered)
  }

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term)
  }, [])

  // Çoxlu modal açmaq üçün funksiya
  const openModalForInvoice = async (invoiceId: number | null = null) => {
    try {
      let fullInvoice: PurchaseInvoice | null = null
      if (invoiceId) {
        fullInvoice = await purchaseInvoicesAPI.getById(invoiceId.toString())
      }
      
      const modalId = invoiceId ? `modal-${invoiceId}-${Date.now()}` : `modal-new-${Date.now()}`
      
      // Yeni modalın pozisiyasını hesabla (yan-yana yerləşdirmək üçün)
      const visibleModalsCount = Array.from(openModals.values()).filter(m => {
        const windowId = `purchase-invoice-modal-${m.id}`
        const store = useWindowStore.getState()
        const windowInfo = store.windows.get(windowId)
        return !windowInfo?.isMinimized
      }).length
      
      const modalCount = visibleModalsCount
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight
      const modalWidth = Math.min(900, Math.floor((screenWidth - 60) / 2))
      const modalHeight = Math.min(700, screenHeight - 80)
      
      // Invoice date formatla - saat, dəqiqə, saniyə ilə
      let invoiceDateStr = ''
      if (fullInvoice?.invoice_date) {
        const date = new Date(fullInvoice.invoice_date)
        invoiceDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
      }
      
      // Invoice items formatla
      const invoiceItemsData = fullInvoice ? (fullInvoice.purchase_invoice_items || []) : []
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
          x: modalCount % 2 === 0 ? 20 : Math.floor(screenWidth / 2) + 10,
          y: Math.floor(modalCount / 2) * (modalHeight + 20) + 50
        },
        size: {
          width: modalWidth,
          height: modalHeight
        },
        isMaximized: false,
        zIndex: newZIndex,
        invoiceType: 'purchase',
        isActive: fullInvoice ? fullInvoice.is_active || false : undefined, // Qaimənin təsdiq statusu
        data: {
          selectedSupplierId: fullInvoice?.supplier_id || null,
          selectedSupplier: fullInvoice?.suppliers || null,
          invoiceItems: items,
          notes: fullInvoice?.notes || '',
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
      
      // Global window store-a əlavə et
      const windowId = `purchase-invoice-modal-${modalId}`
      addWindow({
        id: windowId,
        title: invoiceId ? `Qaimə #${fullInvoice?.invoice_number || invoiceId}` : 'Yeni Alış Qaiməsi',
        type: 'modal',
        modalType: 'invoice-edit',
        isVisible: true,
        isMinimized: false,
        zIndex: newZIndex,
        onActivate: () => {
          setActiveModalId(modalId)
        },
        onClose: () => {
          handleModalClose(modalId)
        }
      })
    } catch (err: any) {
      console.error('Modal açılarkən xəta:', err)
      alert('Modal açılarkən xəta baş verdi')
    }
  }

  const handleEdit = async (selectedIds: (number | string)[]) => {
    if (selectedIds.length === 1) {
      const invoiceId = parseInt(selectedIds[0].toString())
      await openModalForInvoice(invoiceId)
    }
  }

  const handleDelete = async (selectedIds: (number | string)[]) => {
    if (confirm(`${selectedIds.length} qaimə silinsin?`)) {
      try {
        await Promise.all(selectedIds.map(id => purchaseInvoicesAPI.delete(id.toString())))
        await loadInvoices()
        alert('Qaimələr silindi')
      } catch (err: any) {
        alert(err.response?.data?.message || 'Silinərkən xəta baş verdi')
      }
    }
  }

  const handleCopy = (_selectedIds: (number | string)[]) => {
    // TODO: Kopyalama funksiyası
    alert('Kopyalama funksiyası hazırlanır...')
  }

  // F4 qısayolu üçün useEffect (yalnız modal açıq deyilsə)
  useEffect(() => {
    // Modal açıq olduqda qısa yolları deaktiv et
    const hasOpenModals = openModals.size > 0
    if (hasOpenModals) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // F4 basıldıqda
      if (e.key === 'F4') {
        // Aktiv element yoxla
        const activeElement = document.activeElement as HTMLElement
        
        // Təchizatçı input-undadırsa
        if (activeElement && activeElement.getAttribute('data-supplier-input') === 'true') {
          e.preventDefault()
          setShowSupplierModal(true)
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
  }, [openModals])

  // Modal yönetim fonksiyonları
  const handleModalUpdate = (modalId: string, updates: Partial<ModalData>) => {
    setOpenModals(prev => {
      const newMap = new Map(prev)
      const currentModal = newMap.get(modalId)
      if (currentModal) {
        newMap.set(modalId, { ...currentModal, ...updates })
      }
      return newMap
    })
  }

  const handleModalClose = (modalId: string) => {
    setOpenModals(prev => {
      const newMap = new Map(prev)
      newMap.delete(modalId)
      return newMap
    })
    if (activeModalId === modalId) {
      const remainingModals = Array.from(openModals.values()).filter(m => m.id !== modalId)
      if (remainingModals.length > 0) {
        const topModal = remainingModals.reduce((prev, curr) => 
          curr.zIndex > prev.zIndex ? curr : prev
        )
        setActiveModalId(topModal.id)
      } else {
        setActiveModalId(null)
      }
    }
    const windowId = `purchase-invoice-modal-${modalId}`
    removeWindow(windowId)
  }

  const handleModalSave = async (modalId: string, modalData: ModalData['data']) => {
    const modal = openModals.get(modalId)
    if (!modal) return

    const validItems = modalData.invoiceItems.filter(item => item.product_id !== null)
    if (validItems.length === 0) {
      alert('Ən azı bir məhsul seçilməlidir')
      return
    }

    try {
      const items = validItems.map(item => ({
        product_id: item.product_id!,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }))

      if (modal.invoiceId) {
        // Mövcud qaimə - yenilə
        await purchaseInvoicesAPI.update(modal.invoiceId.toString(), {
          supplier_id: modalData.selectedSupplierId || undefined,
          items,
          notes: modalData.notes || undefined,
        })
        // Vəziyyəti dəyişdirmə - mövcud vəziyyəti saxla
        if (modal.isActive !== undefined) {
          await purchaseInvoicesAPI.updateStatus(modal.invoiceId.toString(), modal.isActive)
        }
        alert('Qaimə uğurla yeniləndi')
      } else {
        // Yeni qaimə - yarad, amma tesdiqsiz saxla
        const newInvoice = await purchaseInvoicesAPI.create({
          supplier_id: modalData.selectedSupplierId || undefined,
          items,
          notes: modalData.notes || undefined,
        })
        // Tesdiqsiz saxla (default olaraq tesdiqsizdir, amma açıq şəkildə təyin edək)
        if (newInvoice.id) {
          await purchaseInvoicesAPI.updateStatus(newInvoice.id.toString(), false)
        }
        
        // Qaimə tarixini formatla (saat, dəqiqə, saniyə ilə)
        let invoiceDateStr = ''
        if (newInvoice.invoice_date) {
          const date = new Date(newInvoice.invoice_date)
          invoiceDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
        }
        
        // Modalı yenilə - qaimə nömrəsi və tarixi əlavə et
        setOpenModals(prev => {
          const newMap = new Map(prev)
          const currentModal = newMap.get(modalId)
          if (currentModal) {
            newMap.set(modalId, {
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
        
        alert('Qaimə uğurla yaradıldı (təsdiqsiz)')
      }

      await loadInvoices()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Qaimə yadda saxlanılarkən xəta baş verdi')
      throw err // Xətanı yuxarı at ki, modal bağlanmasın
    }
  }

  const handleModalSaveAndConfirm = async (modalId: string, modalData: ModalData['data']) => {
    const modal = openModals.get(modalId)
    if (!modal) return

    const validItems = modalData.invoiceItems.filter(item => item.product_id !== null)
    if (validItems.length === 0) {
      alert('Ən azı bir məhsul seçilməlidir')
      return
    }

    try {
      const items = validItems.map(item => ({
        product_id: item.product_id!,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }))

      if (modal.invoiceId) {
        // Mövcud qaimə - yenilə və təsdiqlə
        await purchaseInvoicesAPI.update(modal.invoiceId.toString(), {
          supplier_id: modalData.selectedSupplierId || undefined,
          items,
          notes: modalData.notes || undefined,
        })
        // Təsdiqlə
        await purchaseInvoicesAPI.updateStatus(modal.invoiceId.toString(), true)
        alert('Qaimə uğurla yeniləndi və təsdiq edildi')
      } else {
        // Yeni qaimə - yarad və təsdiqlə
        const newInvoice = await purchaseInvoicesAPI.create({
          supplier_id: modalData.selectedSupplierId || undefined,
          items,
          notes: modalData.notes || undefined,
        })
        // Təsdiqlə
        if (newInvoice.id) {
          await purchaseInvoicesAPI.updateStatus(newInvoice.id.toString(), true)
        }
        
        // Qaimə tarixini formatla (saat, dəqiqə, saniyə ilə)
        let invoiceDateStr = ''
        if (newInvoice.invoice_date) {
          const date = new Date(newInvoice.invoice_date)
          invoiceDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
        }
        
        // Modalı yenilə - qaimə nömrəsi və tarixi əlavə et
        setOpenModals(prev => {
          const newMap = new Map(prev)
          const currentModal = newMap.get(modalId)
          if (currentModal) {
            newMap.set(modalId, {
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
        
        alert('Qaimə uğurla yaradıldı və təsdiq edildi')
      }

      await loadInvoices()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Qaimə yadda saxlanılarkən xəta baş verdi')
      throw err // Xətanı yuxarı at ki, modal bağlanmasın
    }
  }

  const handleModalActivate = (modalId: string) => {
    const newZIndex = baseZIndex + 1
    setBaseZIndex(newZIndex)
    setActiveModalId(modalId)
    setOpenModals(prev => {
      const newMap = new Map(prev)
      const currentModal = newMap.get(modalId)
      if (currentModal) {
        newMap.set(modalId, { ...currentModal, zIndex: newZIndex })
      }
      return newMap
    })
    const windowId = `purchase-invoice-modal-${modalId}`
    useWindowStore.getState().updateWindow(windowId, { zIndex: newZIndex, isVisible: true, isMinimized: false })
  }


  const handlePrint = async () => {
    // Seçilmiş sənədləri al
    const invoicesToPrint = selectedInvoiceIds.length > 0 
      ? invoices.filter(inv => selectedInvoiceIds.includes(inv.id))
      : []
    
    if (invoicesToPrint.length === 0) {
      alert('Çap üçün sənəd seçilməyib')
      return
    }

    // Hər sənədi tam məlumatla yüklə
    const fullInvoices = await Promise.all(
      invoicesToPrint.map(async (inv) => {
        try {
          const fullInvoice = await purchaseInvoicesAPI.getById(inv.id.toString())
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
            <title>Alış Qaimələri</title>
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

      fullInvoices.forEach((invoice: PurchaseInvoice, index: number) => {
        const invoiceDate = invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('az-AZ') : '-'
        const items = invoice.purchase_invoice_items || []
        const totalAmount = invoice.total_amount ? Number(invoice.total_amount) : 0

        htmlContent += `
          <div class="invoice ${index < fullInvoices.length - 1 ? 'invoice-break' : ''}">
            <div class="invoice-header">
              <h2>ALIŞ QAIMƏSİ</h2>
            </div>
            <div class="invoice-info">
              <div>
                <p><strong>Faktura №:</strong> ${invoice.invoice_number || ''}</p>
                <p><strong>Tarix:</strong> ${invoiceDate}</p>
              </div>
              <div>
                <p><strong>Təchizatçı:</strong> ${invoice.suppliers?.name || '-'}</p>
                ${invoice.suppliers?.phone ? `<p><strong>Telefon:</strong> ${invoice.suppliers.phone}</p>` : ''}
                ${invoice.suppliers?.address ? `<p><strong>Ünvan:</strong> ${invoice.suppliers.address}</p>` : ''}
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
  }

  // DataTable üçün məlumatları formatla
  const tableData = filteredInvoices.map(invoice => ({
    ...invoice,
    is_active_status: invoice.is_active ? '✓' : '',
    supplier_name: invoice.suppliers?.name || '-',
    invoice_date: invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('az-AZ') : '-',
    total_amount: invoice.total_amount ? `${Number(invoice.total_amount).toFixed(2)} ₼` : '0.00 ₼',
    created_at: invoice.created_at ? new Date(invoice.created_at).toLocaleDateString('az-AZ') : '-',
  }))

  return (
    <ProtectedRoute>
      <Layout>
        <DataTable
          pageId="alis-qaimeleri"
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
                alert('Qaimə seçilməyib')
                return
              }
              try {
                await Promise.all(selectedIds.map(id => purchaseInvoicesAPI.updateStatus(id.toString(), true)))
                await loadInvoices()
                setSelectedInvoiceIds([])
                alert('Qaimələr təsdiq edildi')
              } catch (err: any) {
                alert(err.response?.data?.message || 'Xəta baş verdi')
              }
            },
            onDeactivate: async (selectedIds: (number | string)[]) => {
              if (selectedIds.length === 0) {
                alert('Qaimə seçilməyib')
                return
              }
              try {
                await Promise.all(selectedIds.map(id => purchaseInvoicesAPI.updateStatus(id.toString(), false)))
                await loadInvoices()
                setSelectedInvoiceIds([])
                alert('Qaimələr təsdiq edilmədi')
              } catch (err: any) {
                alert(err.response?.data?.message || 'Xəta baş verdi')
              }
            },
          }}
          onSearch={handleSearch}
          onRowSelect={setSelectedInvoiceIds}
          onRowClick={(_row, id) => {
            // Dubl klik zamanı sənədi aç
            handleEdit([id])
          }}
          rightToolbarItems={[
            <button
              key="activate"
              onClick={async () => {
                if (selectedInvoiceIds.length === 0) {
                  alert('Qaimə seçilməyib')
                  return
                }
                try {
                  await Promise.all(selectedInvoiceIds.map(id => purchaseInvoicesAPI.updateStatus(id.toString(), true)))
                  await loadInvoices()
                  setSelectedInvoiceIds([])
                } catch (err: any) {
                  alert(err.response?.data?.message || 'Xəta baş verdi')
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
                  alert('Qaimə seçilməyib')
                  return
                }
                try {
                  await Promise.all(selectedInvoiceIds.map(id => purchaseInvoicesAPI.updateStatus(id.toString(), false)))
                  await loadInvoices()
                  setSelectedInvoiceIds([])
                } catch (err: any) {
                  alert(err.response?.data?.message || 'Xəta baş verdi')
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
          leftToolbarItems={[
            <button
              key="refresh"
              onClick={loadInvoices}
              style={{
                padding: '0.5rem 1rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              🔄 Yenilə
            </button>,
            <button
              key="add"
              onClick={() => openModalForInvoice(null)}
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
        />


        {/* Çoxlu Purchase Invoice Modalları */}
        {Array.from(openModals.values()).map((modal, index) => {
          const windowId = `purchase-invoice-modal-${modal.id}`
          const windowInfo = windows.get(windowId)
          const isMinimized = windowInfo?.isMinimized || false
          const isVisible = windowInfo?.isVisible !== false
          
          if (isMinimized || !isVisible) return null
          
          return (
            <InvoiceModal
              key={modal.id}
              modal={modal}
              suppliers={suppliers}
              products={products}
              modalIndex={index}
              isActive={activeModalId === modal.id}
              onClose={handleModalClose}
              onUpdate={handleModalUpdate}
              onSave={handleModalSave}
              onSaveAndConfirm={handleModalSaveAndConfirm}
              onActivate={handleModalActivate}
              windowId={windowId}
              onPrint={async (modalId, _modalData) => {
                const modal = openModals.get(modalId)
                if (!modal || !modal.invoiceId) {
                  alert('Yalnız mövcud qaimələr çap edilə bilər')
                  return
                }

                try {
                  const fullInvoice = await purchaseInvoicesAPI.getById(modal.invoiceId.toString())
                  const printWindow = window.open('', '_blank')
                  if (printWindow) {
                    const invoiceDate = fullInvoice.invoice_date ? new Date(fullInvoice.invoice_date).toLocaleDateString('az-AZ') : '-'
                    const items = fullInvoice.purchase_invoice_items || []
                    const totalAmount = fullInvoice.total_amount ? Number(fullInvoice.total_amount) : 0

                    let htmlContent = `
                      <html>
                        <head>
                          <title>Alış Qaiməsi</title>
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
                              <h2>ALIŞ QAIMƏSİ</h2>
                            </div>
                            <div class="invoice-info">
                              <div>
                                <p><strong>Faktura №:</strong> ${fullInvoice.invoice_number || ''}</p>
                                <p><strong>Tarix:</strong> ${invoiceDate}</p>
                              </div>
                              <div>
                                <p><strong>Təchizatçı:</strong> ${fullInvoice.suppliers?.name || '-'}</p>
                                ${fullInvoice.suppliers?.phone ? `<p><strong>Telefon:</strong> ${fullInvoice.suppliers.phone}</p>` : ''}
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
                  alert(err.response?.data?.message || 'Qaimə çap edilərkən xəta baş verdi')
                }
              }}
            />
          )
        })}
        
      </Layout>
    </ProtectedRoute>
  )
}
