import { useState, useEffect, useRef } from 'react'
import Layout, { useNavbarGestureSettings } from '../../components/Layout'
import Toast from '../../components/Toast'
import { customersAPI, customerFoldersAPI } from '../../services/api'
import type { Customer } from '@shared/types'

interface Folder {
  id: number
  name: string
  parent_id: number | null
  children?: Folder[]
  customer_count?: number
}

export default function Alicilar() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set())
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null)
  const [addFolderModalOpen, setAddFolderModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [addCustomerModalOpen, setAddCustomerModalOpen] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null) // Redaktə edilən müştəri ID
  const [newCustomer, setNewCustomer] = useState({
    code: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    folder_id: null as number | null,
  })
  const [moveMode, setMoveMode] = useState(false) // Müştəri köçürmə rejimi
  const [moveFolderMode, setMoveFolderMode] = useState(false) // Papka köçürmə rejimi
  const [folderToMove, setFolderToMove] = useState<number | null>(null) // Köçürüləcək papka
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false) // Ayarlar modalı
  const [settingsTab, setSettingsTab] = useState<'columns' | 'functions'>('columns') // Ayarlar tab
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('customerTableColumnVisibility')
    return saved ? JSON.parse(saved) : {
      checkbox: true,
      code: true,
      name: true,
      phone: true,
      folder: true,
      balance: true,
    }
  })
  const [folderViewMode, setFolderViewMode] = useState<'sidebar' | 'accordion'>(() => {
    // localStorage-dan oxu
    const saved = localStorage.getItem('folderViewMode')
    return (saved === 'sidebar' || saved === 'accordion') ? saved : 'sidebar'
  }) // Papka görünüş rejimi
  const [folderTreeVisible, setFolderTreeVisible] = useState(() => {
    // localStorage-dan oxu, yoxdursa false (gizli)
    const saved = localStorage.getItem('folderTreeVisible')
    return saved === 'true' ? true : false
  }) // Papka ağacının görünürlüyü
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; folderId: number | null } | null>(null) // Kontekst menyu
  const [debugMode] = useState(false) // Debug mode - border və ölçüləri göstərmək üçün
  const [isMobile, setIsMobile] = useState(false) // Mobil cihaz yoxlaması
  
  // Navbar gesture ayarları
  const {
    topNavbarGestureEnabled,
    setTopNavbarGestureEnabled,
    bottomNavbarGestureEnabled,
    setBottomNavbarGestureEnabled,
  } = useNavbarGestureSettings()
  
  // Ekran ölçüsünü yoxla
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // Sütun konfiqurasiyası
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('customerTableColumnOrder')
    return saved ? JSON.parse(saved) : ['checkbox', 'code', 'name', 'phone', 'folder', 'balance']
  })
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('customerTableColumnWidths')
    return saved ? JSON.parse(saved) : {
      checkbox: 50,
      code: 120,
      name: 200,
      phone: 150,
      folder: 150,
      balance: 100,
    }
  })
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(() => {
    const saved = localStorage.getItem('customerTableSortConfig')
    return saved ? JSON.parse(saved) : null
  })
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [_touchStartX, setTouchStartX] = useState<number | null>(null)
  const [_touchStartColumn, setTouchStartColumn] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const thRefs = useRef<Map<string, HTMLTableCellElement>>(new Map())

  useEffect(() => {
    loadCustomers()
    loadFolders()
  }, [])

  // Sütun konfiqurasiyasını localStorage-a yaz
  useEffect(() => {
    localStorage.setItem('customerTableColumnOrder', JSON.stringify(columnOrder))
  }, [columnOrder])

  useEffect(() => {
    localStorage.setItem('customerTableColumnWidths', JSON.stringify(columnWidths))
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
        setTouchStartX(touch.clientX)
        setTouchStartColumn(columnKey)
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
        setTouchStartX(null)
        setTouchStartColumn(null)
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

  // Drag & Drop funksiyaları (Mouse)
  const handleDragStart = (e: React.DragEvent, columnKey: string) => {
    if (columnKey === 'checkbox') return // Checkbox sütununu sürüşdürmə
    setDraggedColumn(columnKey)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault()
    if (!draggedColumn || draggedColumn === targetColumn || targetColumn === 'checkbox') return

    const newOrder = [...columnOrder]
    const draggedIndex = newOrder.indexOf(draggedColumn)
    const targetIndex = newOrder.indexOf(targetColumn)

    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedColumn)

    setColumnOrder(newOrder)
    setDraggedColumn(null)
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
    try {
      if (e.cancelable) {
        e.preventDefault()
      }
    } catch (err) {
      // Ignore passive listener error
    }
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

  // Sütun konfiqurasiyası
  const columnConfig: Record<string, { label: string; align?: 'left' | 'right' | 'center'; render?: (customer: Customer) => React.ReactNode }> = {
    checkbox: { label: '№', align: 'center' },
    code: { label: 'Kod', align: 'left' },
    name: { label: 'Ad', align: 'left' },
    phone: { label: 'Telefon', align: 'left' },
    folder: { label: 'Papka', align: 'left' },
    balance: { label: 'Balans', align: 'right' },
  }

  // Sütun görünürlüyünü localStorage-a yaz
  useEffect(() => {
    localStorage.setItem('customerTableColumnVisibility', JSON.stringify(columnVisibility))
  }, [columnVisibility])

  // Varsayılanlara qaytar
  const handleResetToDefaults = () => {
    const defaultOrder = ['checkbox', 'code', 'name', 'phone', 'folder', 'balance']
    const defaultWidths = {
      checkbox: 50,
      code: 120,
      name: 200,
      phone: 150,
      folder: 150,
      balance: 100,
    }
    const defaultVisibility = {
      checkbox: true,
      code: true,
      name: true,
      phone: true,
      folder: true,
      balance: true,
    }
    setColumnOrder(defaultOrder)
    setColumnWidths(defaultWidths)
    setColumnVisibility(defaultVisibility)
    setSortConfig(null)
    localStorage.setItem('customerTableColumnOrder', JSON.stringify(defaultOrder))
    localStorage.setItem('customerTableColumnWidths', JSON.stringify(defaultWidths))
    localStorage.setItem('customerTableColumnVisibility', JSON.stringify(defaultVisibility))
    localStorage.removeItem('customerTableSortConfig')
  }

  // Sütun yerdəyişdirmə (yuxarı/aşağı)
  const handleMoveColumn = (columnKey: string, direction: 'up' | 'down') => {
    const currentIndex = columnOrder.indexOf(columnKey)
    if (currentIndex === -1) return
    
    const newOrder = [...columnOrder]
    if (direction === 'up' && currentIndex > 0) {
      [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]]
    } else if (direction === 'down' && currentIndex < newOrder.length - 1) {
      [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]]
    }
    setColumnOrder(newOrder)
  }

  const loadFolders = async () => {
    try {
      const data = await customerFoldersAPI.getAll()
      setFolders(data)
    } catch (error: any) {
      console.error('Papkalar yüklənərkən xəta:', error)
      // Network error varsa, backend server işləmir
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        console.warn('Backend server işləmir. Zəhmət olmasa backend-i başlatın.')
      }
    }
  }

  const loadCustomers = async () => {
    try {
      setLoading(true)
      const data = await customersAPI.getAll()
      setCustomers(data)
    } catch (error: any) {
      console.error('Alıcılar yüklənərkən xəta:', error)
      // Network error varsa, backend server işləmir
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        console.warn('Backend server işləmir. Zəhmət olmasa backend-i başlatın.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (id: number) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleAdd = () => {
    // Seçilmiş papkanı default olaraq təyin et
    setEditingCustomerId(null) // Yeni müştəri rejimi
    setNewCustomer({
      code: '', // Kod avtomatik generasiya olunacaq
      name: '',
      phone: '',
      email: '',
      address: '',
      folder_id: selectedFolder,
    })
    setAddCustomerModalOpen(true)
  }

  const handleEdit = () => {
    if (selectedIds.size !== 1) {
      setToast({ message: 'Zəhmət olmasa redaktə etmək üçün bir müştəri seçin', type: 'info' })
      return
    }

    const customerId = Array.from(selectedIds)[0]
    const customer = customers.find(c => c.id === customerId)
    
    if (!customer) {
      setToast({ message: 'Müştəri tapılmadı', type: 'error' })
      return
    }

    // Müştəri məlumatlarını form-a yüklə
    setNewCustomer({
      code: customer.code || '',
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      folder_id: customer.folder_id,
    })
    setEditingCustomerId(customerId)
    setAddCustomerModalOpen(true)
  }

  const handleDelete = async () => {
    if (selectedIds.size === 0) {
      setToast({ message: 'Zəhmət olmasa silmək üçün müştəri seçin', type: 'info' })
      return
    }

    // Təsdiq soruş
    const confirmMessage = selectedIds.size === 1
      ? 'Bu müştərini silmək istədiyinizə əminsiniz?'
      : `${selectedIds.size} müştərini silmək istədiyinizə əminsiniz?`

    if (!window.confirm(confirmMessage)) {
      return
    }

    try {
      const selectedCount = selectedIds.size
      const selectedIdsArray = Array.from(selectedIds)
      
      // Seçilmiş müştəriləri sil
      const deletePromises = selectedIdsArray.map(id => 
        customersAPI.delete(String(id))
      )
      
      await Promise.all(deletePromises)

      // Customers state-dən sil
      setCustomers(customers.filter(c => !selectedIds.has(c.id)))
      
      // Seçimləri təmizlə
      setSelectedIds(new Set())
      
      setToast({ 
        message: `${selectedCount} müştəri uğurla silindi`, 
        type: 'success' 
      })
    } catch (error: any) {
      console.error('Müştəri silinərkən xəta:', error)
      setToast({ 
        message: error.response?.data?.message || 'Müştəri silinərkən xəta baş verdi', 
        type: 'error' 
      })
    }
  }

  const handleCopy = () => {
    // TODO: Kopyala
    if (selectedIds.size > 0) {
      console.log('Kopyala:', Array.from(selectedIds))
    }
  }

  const handleRefresh = () => {
    loadCustomers()
  }

  const handleSearch = () => {
    setSearchOpen(!searchOpen)
    setFilterOpen(false)
    setSettingsOpen(false)
    setFolderOpen(false)
  }

  const handleFilter = () => {
    setFilterOpen(!filterOpen)
    setSearchOpen(false)
    setSettingsOpen(false)
    setFolderOpen(false)
  }

  const handleSettings = () => {
    setSettingsModalOpen(true)
  }

  const handleFolder = () => {
    const newFolderOpen = !folderOpen
    setFolderOpen(newFolderOpen)
    setSearchOpen(false)
    setFilterOpen(false)
    setSettingsOpen(false)
    // Papka bağlandıqda yalnız "Bütün alıcılar" göstər
    if (!newFolderOpen) {
      setSelectedFolder(null)
      setSelectedIds(new Set())
      if (moveMode) {
        setMoveMode(false)
      }
      if (moveFolderMode) {
        setMoveFolderMode(false)
        setFolderToMove(null)
      }
    }
  }

  const toggleFolder = (folderId: number | -1) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }

  const handleAddFolder = () => {
    setNewFolderName('')
    setAddFolderModalOpen(true)
  }

  const handleSaveFolder = async () => {
    if (!newFolderName.trim()) {
      setToast({ message: 'Papka adı boş ola bilməz', type: 'error' })
      return
    }

    try {
      // API-yə göndər
      const newFolder = await customerFoldersAPI.create({
        name: newFolderName.trim(),
        parent_id: selectedFolder,
      })

      // Folders state-ə əlavə et
      setFolders([...folders, newFolder])
      
      // Əgər seçilmiş papka varsa, onu genişləndir ki, yeni papka görünsün
      if (selectedFolder !== null) {
        setExpandedFolders(new Set([...expandedFolders, selectedFolder]))
      }

      // Modalı bağla
      setAddFolderModalOpen(false)
      setNewFolderName('')
      setToast({ message: 'Papka uğurla yaradıldı', type: 'success' })
    } catch (error: any) {
      console.error('Papka yaradılarkən xəta:', error)
      setToast({ 
        message: error.response?.data?.message || 'Papka yaradılarkən xəta baş verdi', 
        type: 'error' 
      })
    }
  }

  const handleSaveCustomer = async (isActive: boolean = false) => {
    if (!newCustomer.name.trim()) {
      setToast({ message: 'Müştəri adı məcburidir', type: 'error' })
      return
    }

    try {
      if (editingCustomerId !== null) {
        // Redaktə rejimi - Update
        // Kod yoxdursa və ya boşdursa, null göndər ki, backend avtomatik generasiya etsin
        const customerCode = newCustomer.code.trim() || null
        const updatedCustomer = await customersAPI.update(String(editingCustomerId), {
          code: customerCode,
          name: newCustomer.name.trim(),
          phone: newCustomer.phone.trim() || null,
          email: newCustomer.email.trim() || null,
          address: newCustomer.address.trim() || null,
          folder_id: newCustomer.folder_id,
          is_active: isActive,
        })

        // Customers state-ə yenilə
        setCustomers(customers.map(c => c.id === editingCustomerId ? updatedCustomer : c))
        setToast({ message: 'Müştəri uğurla yeniləndi', type: 'success' })
      } else {
        // Yeni müştəri - Create
        const createdCustomer = await customersAPI.create({
          code: newCustomer.code.trim() || null,
          name: newCustomer.name.trim(),
          phone: newCustomer.phone.trim() || null,
          email: newCustomer.email.trim() || null,
          address: newCustomer.address.trim() || null,
          balance: 0, // Default balans 0
          folder_id: newCustomer.folder_id,
          is_active: isActive,
        })

        // Customers state-ə əlavə et
        setCustomers([...customers, createdCustomer])
        setToast({ 
          message: isActive 
            ? 'Müştəri uğurla yaradıldı və aktiv edildi' 
            : 'Müştəri uğurla yaradıldı (passiv)', 
          type: 'success' 
        })
      }

      // Modalı bağla və formu təmizlə
      setAddCustomerModalOpen(false)
      setEditingCustomerId(null)
      setNewCustomer({
        code: '',
        name: '',
        phone: '',
        email: '',
        address: '',
        folder_id: selectedFolder, // Seçilmiş papkanı default olaraq saxla
      })
    } catch (error: any) {
      console.error('Müştəri saxlanarkən xəta:', error)
      setToast({ 
        message: error.response?.data?.message || (editingCustomerId ? 'Müştəri yenilənərkən xəta baş verdi' : 'Müştəri yaradılarkən xəta baş verdi'), 
        type: 'error' 
      })
    }
  }

  const handleEditFolder = async (folderId: number) => {
    const folder = folders.find(f => f.id === folderId)
    if (!folder) return

    const newName = prompt('Papka adını dəyişdir:', folder.name)
    if (!newName || !newName.trim()) return

    try {
      const updatedFolder = await customerFoldersAPI.update(String(folderId), {
        name: newName.trim(),
        parent_id: folder.parent_id,
      })

      setFolders(folders.map(f => f.id === folderId ? updatedFolder : f))
      setToast({ message: 'Papka adı uğurla dəyişdirildi', type: 'success' })
    } catch (error: any) {
      console.error('Papka yenilənərkən xəta:', error)
      setToast({ 
        message: error.response?.data?.message || 'Papka yenilənərkən xəta baş verdi', 
        type: 'error' 
      })
    }
  }

  const handleDeleteFolder = async (folderId: number) => {
    if (!confirm('Bu papkanı silmək istədiyinizə əminsiniz?')) return

    try {
      await customerFoldersAPI.delete(String(folderId))
      setFolders(folders.filter(f => f.id !== folderId))
      if (selectedFolder === folderId) {
        setSelectedFolder(null)
      }
      setToast({ message: 'Papka uğurla silindi', type: 'success' })
    } catch (error: any) {
      console.error('Papka silinərkən xəta:', error)
      setToast({ 
        message: error.response?.data?.message || 'Papka silinərkən xəta baş verdi', 
        type: 'error' 
      })
    }
  }

  const handleStartMoveFolderMode = (folderId: number) => {
    setFolderToMove(folderId)
    setMoveFolderMode(true)
    setToast({ message: 'İndi hədəf papkaya basın', type: 'info' })
  }

  const handleCancelMoveFolderMode = () => {
    setMoveFolderMode(false)
    setFolderToMove(null)
    setToast({ message: 'Papka köçürmə ləğv edildi', type: 'info' })
  }

  const handleMoveFolder = async (targetFolderId: number | null) => {
    if (folderToMove === null) return

    // Özünü özünün alt papkası etməyə çalışırsa
    if (targetFolderId === folderToMove) {
      setToast({ message: 'Papka özünün alt papkası ola bilməz', type: 'error' })
      return
    }

    // Döngü yoxlaması: hədəf papka köçürüləcək papkanın alt papkasıdırsa
    const checkCircular = (folderId: number, targetId: number | null): boolean => {
      if (targetId === null) return false
      const targetFolder = folders.find(f => f.id === targetId)
      if (!targetFolder) return false
      
      let currentId = targetFolder.parent_id
      while (currentId !== null) {
        if (currentId === folderId) return true
        const parent = folders.find(f => f.id === currentId)
        if (!parent) break
        currentId = parent.parent_id
      }
      return false
    }

    if (checkCircular(folderToMove, targetFolderId)) {
      setToast({ message: 'Döngü yaradıla bilməz', type: 'error' })
      return
    }

    const folder = folders.find(f => f.id === folderToMove)
    if (!folder) return

    const targetFolderName = targetFolderId === null 
      ? 'Bütün alıcılar (root)' 
      : folders.find(f => f.id === targetFolderId)?.name || 'Naməlum papka'

    try {
      await customerFoldersAPI.update(String(folderToMove), {
        name: folder.name,
        parent_id: targetFolderId,
      })

      // Folders state-ə yenilə
      await loadFolders()
      
      // Köçürmə rejimini söndür
      setMoveFolderMode(false)
      setFolderToMove(null)
      
      // Əgər köçürülən papka seçilmişdirsə, onu yenilə
      if (selectedFolder === folderToMove) {
        // Yeni parent-ı seç və ya null-a qayıt
        setSelectedFolder(targetFolderId)
      }

      setToast({ 
        message: `"${folder.name}" papkası "${targetFolderName}" papkasına köçürüldü`, 
        type: 'success' 
      })
    } catch (error: any) {
      console.error('Papka köçürülərkən xəta:', error)
      setToast({ 
        message: error.response?.data?.message || 'Papka köçürülərkən xəta baş verdi', 
        type: 'error' 
      })
    }
  }

  const handleStartMoveMode = () => {
    if (selectedIds.size === 0) {
      setToast({ message: 'Zəhmət olmasa köçürmək üçün müştəri seçin', type: 'info' })
      return
    }
    setMoveMode(true)
    setToast({ message: 'İndi papka seçin', type: 'info' })
  }

  const handleCancelMoveMode = () => {
    setMoveMode(false)
    setToast({ message: 'Köçürmə ləğv edildi', type: 'info' })
  }

  const handleMoveToFolder = async (folderId: number | null) => {
    if (selectedIds.size === 0) {
      setToast({ message: 'Zəhmət olmasa köçürmək üçün müştəri seçin', type: 'info' })
      return
    }

    const folderName = folderId === null 
      ? 'Bütün alıcılar (papkasız)' 
      : folders.find(f => f.id === folderId)?.name || 'Naməlum papka'

    try {
      const customerIds = Array.from(selectedIds)
      await customersAPI.moveToFolder(customerIds, folderId)
      
      // Müştəriləri yenilə
      await loadCustomers()
      
      // Papkaları yenilə (customer_count dəyişə bilər)
      await loadFolders()
      
      // Seçimləri təmizlə
      setSelectedIds(new Set())
      
      // Köçürmə rejimini söndür
      setMoveMode(false)
      
      setToast({ 
        message: `${customerIds.length} müştəri "${folderName}" papkasına köçürüldü`, 
        type: 'success' 
      })
    } catch (error: any) {
      console.error('Müştərilər köçürülərkən xəta:', error)
      setToast({ 
        message: error.response?.data?.message || 'Müştərilər köçürülərkən xəta baş verdi', 
        type: 'error' 
      })
    }
  }

  // Ağac strukturunu qur
  const buildFolderTree = (folders: Folder[]): Folder[] => {
    const folderMap = new Map<number, Folder>()
    const rootFolders: Folder[] = []

    // Əvvəlcə bütün papkaları map-ə yerləşdir
    folders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] })
    })

    // İndi parent-child əlaqələrini qur
    folders.forEach(folder => {
      const folderNode = folderMap.get(folder.id)!
      if (folder.parent_id === null) {
        rootFolders.push(folderNode)
      } else {
        const parent = folderMap.get(folder.parent_id)
        if (parent) {
          if (!parent.children) {
            parent.children = []
          }
          parent.children.push(folderNode)
        }
      }
    })

    return rootFolders
  }

  const renderFolderTree = (folderList: Folder[], level: number = 0): React.ReactNode => {
    return folderList.map(folder => {
      const hasChildren = folder.children && folder.children.length > 0
      const isExpanded = expandedFolders.has(folder.id)
      const isSelected = selectedFolder === folder.id

      return (
        <div key={folder.id}>
          <div
            onClick={() => {
              if (moveFolderMode && folderToMove !== null) {
                // Papka köçürmə rejimində - papkanı bu papkaya köçür
                handleMoveFolder(folder.id)
              } else if (moveMode) {
                // Müştəri köçürmə rejimində - müştəriləri bu papkaya köçür
                handleMoveToFolder(folder.id)
              } else {
                // Normal rejim - papkanı seç
              setSelectedFolder(folder.id)
                // Papka dəyişdikdə seçimləri təmizlə
                setSelectedIds(new Set())
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              if (selectedIds.size > 0 && !moveMode && !moveFolderMode) {
                handleMoveToFolder(folder.id)
              }
            }}
            style={{
              padding: '0.75rem',
              paddingLeft: `${0.75 + level * 1.5}rem`,
              background: moveFolderMode 
                ? (folderToMove === folder.id ? '#ffebee' : (isSelected ? '#fff3e0' : '#fff9e6'))
                : moveMode 
                  ? (isSelected ? '#fff3e0' : '#fff9e6')
                  : (isSelected ? '#e3f2fd' : 'transparent'),
              borderLeft: isSelected ? '3px solid #1976d2' : (folderToMove === folder.id ? '3px solid #d32f2f' : '3px solid transparent'),
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFolder(folder.id)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  minWidth: '24px',
                  minHeight: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {!hasChildren && <span style={{ width: '24px' }} />}
            <span style={{ fontSize: '1.25rem' }}>📁</span>
            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: isSelected ? 'bold' : 'normal' }}>
              {folder.name}
            </span>
            <span style={{ fontSize: '0.75rem', color: '#666' }}>
              ({getCustomerCountForFolder(folder.id)})
            </span>
          </div>
          {hasChildren && isExpanded && (
            <div>
              {renderFolderTree(folder.children!, level + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  // Accordion görünüşü üçün papka render funksiyası - yalnız seçilmiş papkanın içi
  const renderAccordionCurrentFolder = (): React.ReactNode => {
    if (selectedFolder === null) {
      // Root - bütün root papkaları göstər
      return (
        <>
          {folderTree.map(folder => {
            // const folderCustomers = customers.filter(c => c.folder_id === folder.id)
            // const hasCustomers = folderCustomers.length > 0
            // const hasChildren = folder.children && folder.children.length > 0

            return (
              <div key={folder.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                <div
                  onClick={() => {
                    if (moveFolderMode && folderToMove !== null) {
                      handleMoveFolder(folder.id)
                    } else if (moveMode) {
                      handleMoveToFolder(folder.id)
                    } else {
                      setSelectedFolder(folder.id)
                      setSelectedIds(new Set())
                    }
                  }}
                  style={{
                    padding: '0.75rem 1rem',
                    background: 'white',
                    borderLeft: '3px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    minHeight: '44px',
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>📁</span>
                  <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 'normal' }}>
                    {folder.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#666' }}>
                    ({getCustomerCountForFolder(folder.id)})
                  </span>
                </div>
              </div>
            )
          })}
        </>
      )
    }

    // Seçilmiş papkanı tap
    const findFolder = (id: number, list: Folder[]): Folder | null => {
      for (const folder of list) {
        if (folder.id === id) return folder
        if (folder.children && folder.children.length > 0) {
          const found = findFolder(id, folder.children)
          if (found) return found
        }
      }
      return null
    }

    const currentFolder = findFolder(selectedFolder, folderTree)
    if (!currentFolder) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          Papka tapılmadı
        </div>
      )
    }

    const folderCustomers = customers.filter(c => c.folder_id === currentFolder.id)
    const hasCustomers = folderCustomers.length > 0
    const hasChildren = currentFolder.children && currentFolder.children.length > 0

    // Əgər nə alt papkalar, nə də müştərilər yoxdursa
    if (!hasChildren && !hasCustomers) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          Bu papkada heç nə yoxdur
        </div>
      )
    }

    return (
      <>
        {/* Alt papkalar */}
        {hasChildren && currentFolder.children!.map(folder => {
          return (
            <div key={folder.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <div
                onClick={() => {
                  if (moveFolderMode && folderToMove !== null) {
                    handleMoveFolder(folder.id)
                  } else if (moveMode) {
                    handleMoveToFolder(folder.id)
                  } else {
                    setSelectedFolder(folder.id)
                    setSelectedIds(new Set())
                  }
                }}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'white',
                  borderLeft: '3px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  minHeight: '44px',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>📁</span>
                <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 'normal' }}>
                  {folder.name}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#666' }}>
                  ({getCustomerCountForFolder(folder.id)})
                </span>
              </div>
            </div>
          )
        })}

        {/* Bu papkanın müştəriləri */}
        {hasCustomers && (
          <div style={{ padding: '0.5rem' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.875rem',
                background: 'white',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th
                    style={{
                      padding: '0.5rem',
                      textAlign: 'left',
                      borderBottom: '2px solid #ddd',
                      borderRight: '1px solid #e0e0e0',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      color: '#333',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={folderCustomers.length > 0 && folderCustomers.every(c => selectedIds.has(c.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newSelected = new Set(selectedIds)
                          folderCustomers.forEach(c => newSelected.add(c.id))
                          setSelectedIds(newSelected)
                        } else {
                          const newSelected = new Set(selectedIds)
                          folderCustomers.forEach(c => newSelected.delete(c.id))
                          setSelectedIds(newSelected)
                        }
                      }}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </th>
                  <th
                    style={{
                      padding: '0.5rem',
                      textAlign: 'left',
                      borderBottom: '2px solid #ddd',
                      borderRight: '1px solid #e0e0e0',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      color: '#333',
                    }}
                  >
                    Kod
                  </th>
                  <th
                    style={{
                      padding: '0.5rem',
                      textAlign: 'left',
                      borderBottom: '2px solid #ddd',
                      borderRight: '1px solid #e0e0e0',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      color: '#333',
                    }}
                  >
                    Ad
                  </th>
                  <th
                    style={{
                      padding: '0.5rem',
                      textAlign: 'left',
                      borderBottom: '2px solid #ddd',
                      borderRight: '1px solid #e0e0e0',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      color: '#333',
                    }}
                  >
                    Telefon
                  </th>
                  <th
                    style={{
                      padding: '0.5rem',
                      textAlign: 'left',
                      borderBottom: '2px solid #ddd',
                      borderRight: '1px solid #e0e0e0',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      color: '#333',
                    }}
                  >
                    Papka
                  </th>
                  <th
                    style={{
                      padding: '0.5rem',
                      textAlign: 'right',
                      borderBottom: '2px solid #ddd',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      color: '#333',
                    }}
                  >
                    Balans
                  </th>
                </tr>
              </thead>
              <tbody>
                {folderCustomers.map((customer) => {
                  const isSelected = selectedIds.has(customer.id)
                  return (
                    <tr
                      key={customer.id}
                      onClick={() => handleSelect(customer.id)}
                      style={{
                        background: isSelected ? '#e3f2fd' : 'white',
                        cursor: 'pointer',
                        borderBottom: '1px solid #eee',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = '#f5f5f5'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.background = 'white'
                        }
                      }}
                    >
                      <td
                        style={{
                          padding: '0.5rem',
                          textAlign: 'center',
                          borderRight: '1px solid #e0e0e0',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelect(customer.id)}
                          style={{
                            width: '18px',
                            height: '18px',
                            cursor: 'pointer',
                          }}
                        />
                      </td>
                      <td 
                        style={{ 
                          padding: '0.5rem',
                          borderRight: '1px solid #e0e0e0',
                          color: '#666',
                          fontFamily: 'monospace',
                        }}
                      >
                        {customer.code || '-'}
                      </td>
                      <td 
                        style={{ 
                          padding: '0.5rem',
                          borderRight: '1px solid #e0e0e0',
                          fontWeight: isSelected ? 'bold' : 'normal',
                        }}
                      >
                        {customer.name}
                      </td>
                      <td 
                        style={{ 
                          padding: '0.5rem',
                          borderRight: '1px solid #e0e0e0',
                          color: '#666',
                        }}
                      >
                        {customer.phone || '-'}
                      </td>
                      <td 
                        style={{ 
                          padding: '0.5rem',
                          borderRight: '1px solid #e0e0e0',
                          color: customer.folder_id ? '#1976d2' : '#666',
                          cursor: customer.folder_id ? 'pointer' : 'default',
                          textDecoration: customer.folder_id ? 'underline' : 'none',
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (customer.folder_id) {
                            setSelectedFolder(customer.folder_id)
                            setSelectedIds(new Set())
                            if (folderViewMode === 'accordion') {
                              setFolderOpen(true)
                            }
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (customer.folder_id) {
                            setContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              folderId: customer.folder_id,
                            })
                          }
                        }}
                      >
                        {getFolderNameForCustomer(customer.folder_id)}
                      </td>
                      <td 
                        style={{ 
                          padding: '0.5rem',
                          textAlign: 'right',
                          fontWeight: 'bold',
                          color: customer.balance && customer.balance < 0 ? '#d32f2f' : '#2e7d32',
                        }}
                      >
                        {customer.balance !== null ? Number(customer.balance).toFixed(2) : '0.00'} ₼
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </>
    )
  }

  const folderTree = buildFolderTree(folders)

  // Müştəriləri seçilmiş papkaya görə filtr et
  // Müştərinin papka adını tap (getSortedCustomers-dan əvvəl olmalıdır)
  const getFolderNameForCustomer = (folderId: number | null): string => {
    if (folderId === null) {
      return '-'
    }
    const findFolder = (folderList: Folder[]): Folder | null => {
      for (const folder of folderList) {
        if (folder.id === folderId) return folder
        if (folder.children) {
          const found = findFolder(folder.children)
          if (found) return found
        }
      }
      return null
    }
    
    const folder = findFolder(folders)
    return folder ? folder.name : '-'
  }

  // Sort funksiyası
  const handleSort = (columnKey: string) => {
    if (columnKey === 'checkbox') return // Checkbox sütununu sort etmə
    
    setSortConfig(prev => {
      if (prev?.key === columnKey) {
        // Eyni sütuna basıldıqda istiqaməti dəyiş
        const newDirection: 'asc' | 'desc' = prev.direction === 'asc' ? 'desc' : 'asc'
        const newConfig = { key: columnKey, direction: newDirection }
        localStorage.setItem('customerTableSortConfig', JSON.stringify(newConfig))
        return newConfig
      } else {
        // Yeni sütuna basıldıqda asc ilə başla
        const newConfig: { key: string; direction: 'asc' | 'desc' } = { key: columnKey, direction: 'asc' }
        localStorage.setItem('customerTableSortConfig', JSON.stringify(newConfig))
        return newConfig
      }
    })
  }

  // Sıralanmış müştərilər
  const getSortedCustomers = (customersList: Customer[]) => {
    if (!sortConfig) return customersList

    const sorted = [...customersList].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortConfig.key) {
        case 'code':
          aValue = a.code || ''
          bValue = b.code || ''
          break
        case 'name':
          aValue = a.name || ''
          bValue = b.name || ''
          break
        case 'phone':
          aValue = a.phone || ''
          bValue = b.phone || ''
          break
        case 'folder':
          aValue = getFolderNameForCustomer(a.folder_id) || ''
          bValue = getFolderNameForCustomer(b.folder_id) || ''
          break
        case 'balance':
          aValue = a.balance || 0
          bValue = b.balance || 0
          break
        default:
          return 0
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      } else {
        return sortConfig.direction === 'asc'
          ? (aValue > bValue ? 1 : -1)
          : (aValue < bValue ? 1 : -1)
      }
    })

    return sorted
  }

  const filteredCustomersRaw = selectedFolder === null
    ? customers // Bütün müştərilər
    : customers.filter(customer => customer.folder_id === selectedFolder)
  
  const filteredCustomers = getSortedCustomers(filteredCustomersRaw)

  // Seçilmiş papkadakı müştərilərin sayını hesabla
  const getCustomerCountForFolder = (folderId: number | null) => {
    if (folderId === null) {
      return customers.length
    }
    return customers.filter(c => c.folder_id === folderId).length
  }


  // Seçilmiş papkanın yolunu tap (breadcrumb üçün)
  const getFolderPath = (folderId: number | null): Array<{ id: number | null; name: string }> => {
    const path: Array<{ id: number | null; name: string }> = [
      { id: null, name: 'Bütün alıcılar' }
    ]

    if (folderId === null) {
      return path
    }

    // Papkanı tap
    const findFolder = (id: number): Folder | null => {
      return folders.find(f => f.id === id) || null
    }

    // Parent papkaları tap
    const buildPath = (id: number) => {
      const folder = findFolder(id)
      if (!folder) return

      // Əvvəlcə parent-ı tap
      if (folder.parent_id !== null) {
        buildPath(folder.parent_id)
      }

      // Sonra özünü əlavə et
      path.push({ id: folder.id, name: folder.name })
    }

    buildPath(folderId)
    return path
  }

  const folderPath = getFolderPath(selectedFolder)

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', marginTop: '-56px', paddingTop: '56px' }}>
        {/* Toolbar */}
        <div
          style={{
            background: 'white',
            borderBottom: '1px solid #e0e0e0',
            padding: '0.75rem 1rem',
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            position: 'sticky',
            top: '0',
            zIndex: 100,
            scrollbarWidth: 'thin',
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
          <button
            onClick={handleDelete}
            disabled={selectedIds.size === 0}
            style={{
              background: selectedIds.size > 0 ? '#d32f2f' : '#ccc',
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
            title="Sil"
          >
            🗑️
          </button>
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
          {selectedIds.size > 0 && folderOpen && (
            <>
              {moveMode ? (
                <button
                  onClick={handleCancelMoveMode}
                  style={{
                    background: '#d32f2f',
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
                  title="Köçürməni ləğv et"
                >
                  ✖️
                </button>
              ) : (
                <button
                  onClick={handleStartMoveMode}
                  style={{
                    background: '#9c27b0',
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
                  title="Papkaya köçür"
                >
                  📂
                </button>
              )}
            </>
          )}
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
          
          <div style={{ width: '1px', height: '24px', background: '#ddd', margin: '0 0.25rem' }} />
          
          <button
            onClick={handleFolder}
            style={{
              background: folderOpen ? '#1976d2' : '#757575',
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
            title="Papka"
          >
            📁
          </button>
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
            style={{
              background: '#f5f5f5',
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #e0e0e0',
            }}
          >
            <input
              type="text"
              placeholder="Axtarış..."
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                minHeight: '44px',
              }}
            />
          </div>
        )}

        {/* Filtr paneli */}
        {filterOpen && (
          <div
            style={{
              background: '#f5f5f5',
              padding: '0.75rem 1rem',
              borderBottom: '1px solid #e0e0e0',
            }}
          >
            <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
              Filtr seçimləri
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                style={{
                  padding: '0.5rem 1rem',
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Bütünü
              </button>
              <button
                style={{
                  padding: '0.5rem 1rem',
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Balans {'>'} 0
              </button>
              <button
                style={{
                  padding: '0.5rem 1rem',
                  background: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Balans {'<'} 0
              </button>
            </div>
          </div>
        )}


        {/* Cədvəl və Papka Paneli */}
        <div 
          ref={(el) => {
            if (el) {
              const rect = el.getBoundingClientRect()
              const label = el.querySelector('.debug-label-red') as HTMLElement
              if (label) {
                label.textContent = `RED: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}px`
              }
            }
          }}
            style={{
            display: 'flex', 
            flex: 1, 
            overflow: 'hidden', 
            flexDirection: folderViewMode === 'accordion' ? 'column' : 'row',
            border: debugMode ? '3px solid red' : 'none', // DEBUG
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          {debugMode && (
          <div className="debug-label-red" style={{
            position: 'absolute',
            top: '2px',
            left: '2px',
            background: 'red',
            color: 'white',
            padding: '2px 4px',
            fontSize: '10px',
            zIndex: 10000,
            fontWeight: 'bold',
          }}>RED: Loading...</div>
          )}
          {/* Papka Paneli - Sidebar rejimi */}
          {folderOpen && folderViewMode === 'sidebar' && (
            <div
              ref={(el) => {
                if (el) {
                  const rect = el.getBoundingClientRect()
                  const label = el.querySelector('.debug-label-blue') as HTMLElement
                  if (label) {
                    label.textContent = `BLUE: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}px`
                  }
                }
              }}
              style={{
                width: folderTreeVisible ? '280px' : '0px',
                background: 'white',
                borderTop: debugMode ? '3px solid blue' : 'none', // DEBUG
                borderBottom: debugMode ? '3px solid blue' : 'none', // DEBUG
                borderLeft: debugMode ? '3px solid blue' : 'none', // DEBUG
                borderRight: debugMode ? (folderTreeVisible ? '3px solid blue' : '3px solid blue') : (folderTreeVisible ? '1px solid #e0e0e0' : 'none'), // DEBUG
                display: folderTreeVisible ? 'flex' : 'none',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'width 0.3s ease',
                flexShrink: 0,
                flexGrow: 0,
                flexBasis: folderTreeVisible ? '280px' : '0px',
                boxSizing: 'border-box',
                position: 'relative',
              }}
            >
              {debugMode && (
              <div className="debug-label-blue" style={{
                position: 'absolute',
                top: '2px',
                left: '2px',
                background: 'blue',
                color: 'white',
                padding: '2px 4px',
                fontSize: '10px',
                zIndex: 10000,
                fontWeight: 'bold',
              }}>BLUE: Loading...</div>
              )}
              {/* Papka Paneli Header */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid #e0e0e0',
                  background: '#f5f5f5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  minHeight: '44px',
                }}
              >
                {folderTreeVisible ? (
                  <>
                    <h3 
                      onClick={() => {
                        setFolderTreeVisible(false)
                        localStorage.setItem('folderTreeVisible', 'false')
                      }}
                      style={{ 
                        fontSize: '1rem', 
                        fontWeight: 'bold', 
                        margin: 0,
                        cursor: 'pointer',
                        userSelect: 'none',
                      }}
                    >
                      Papkalar ▼
                    </h3>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    onClick={handleAddFolder}
                    style={{
                      background: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.375rem 0.5rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      minWidth: '32px',
                      minHeight: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Yeni papka"
                  >
                    ➕
                  </button>
                      {selectedFolder && !moveFolderMode && (
                    <>
                      <button
                        onClick={() => handleEditFolder(selectedFolder)}
                        style={{
                          background: '#ff9800',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          minWidth: '32px',
                          minHeight: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Papka adı düzəlt"
                      >
                        ✏️
                      </button>
                          <button
                            onClick={() => handleStartMoveFolderMode(selectedFolder)}
                            style={{
                              background: '#9c27b0',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '0.375rem 0.5rem',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              minWidth: '32px',
                              minHeight: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title="Papkanı köçür"
                          >
                            📂
                      </button>
                      <button
                        onClick={() => handleDeleteFolder(selectedFolder)}
                        style={{
                          background: '#d32f2f',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          minWidth: '32px',
                          minHeight: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Papka sil"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                      {moveFolderMode && (
                        <button
                          onClick={handleCancelMoveFolderMode}
                          style={{
                            background: '#d32f2f',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.375rem 0.5rem',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            minWidth: '32px',
                            minHeight: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          title="Papka köçürməni ləğv et"
                        >
                          ✖️
                        </button>
                  )}
                </div>
                  </>
                ) : null}
              </div>

              {/* Papka Ağacı */}
              {folderTreeVisible && (
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  padding: '0.5rem 0',
                }}
              >
                {/* Bütün alıcılar */}
                <div
                  onClick={() => {
                    if (moveFolderMode && folderToMove !== null) {
                      // Papka köçürmə rejimində - papkanı root-a köçür
                      handleMoveFolder(null)
                    } else if (moveMode) {
                      // Müştəri köçürmə rejimində - müştəriləri papkasız et
                      handleMoveToFolder(null)
                    } else {
                      // Normal rejim - bütün müştəriləri göstər
                      setSelectedFolder(null)
                      // Papka dəyişdikdə seçimləri təmizlə
                      setSelectedIds(new Set())
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    if (selectedIds.size > 0 && !moveMode && !moveFolderMode) {
                      handleMoveToFolder(null)
                    }
                  }}
                  style={{
                    padding: '0.75rem',
                    paddingLeft: '0.75rem',
                    background: moveFolderMode 
                      ? '#fff9e6'
                      : moveMode 
                        ? (selectedFolder === null ? '#fff3e0' : '#fff9e6')
                        : (selectedFolder === null ? '#e3f2fd' : 'transparent'),
                    borderLeft: selectedFolder === null ? '3px solid #1976d2' : '3px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    minHeight: '44px',
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>📦</span>
                  <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: selectedFolder === null ? 'bold' : 'normal' }}>
                    Bütün alıcılar
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#666' }}>
                    ({getCustomerCountForFolder(null)})
                  </span>
                </div>

                {/* Papka ağacı */}
                {renderFolderTree(folderTree)}
              </div>
              )}
            </div>
          )}

          {/* Papka Paneli - Accordion rejimi */}
          {folderOpen && folderViewMode === 'accordion' && (
            <div
              style={{
                width: '100%',
                background: 'white',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                overflow: 'hidden',
              }}
            >
              {/* Papka Paneli Header */}
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid #e0e0e0',
                  background: '#f5f5f5',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                  {/* Geri düyməsi - yalnız papka seçilmişdirsə göstər */}
                  {selectedFolder !== null && (
                    <button
                      onClick={() => {
                        // Parent papkanı tap - breadcrumb path-dən istifadə et
                        const path = getFolderPath(selectedFolder)
                        if (path.length > 1) {
                          // Sonuncudan əvvəlki papka parent-dır
                          const parentId = path[path.length - 2].id
                          setSelectedFolder(parentId)
                          setSelectedIds(new Set())
                          if (moveMode) {
                            setMoveMode(false)
                          }
                          if (moveFolderMode) {
                            setMoveFolderMode(false)
                            setFolderToMove(null)
                          }
                        } else {
                          // Root-a qayıt
                          setSelectedFolder(null)
                          setSelectedIds(new Set())
                          if (moveMode) {
                            setMoveMode(false)
                          }
                          if (moveFolderMode) {
                            setMoveFolderMode(false)
                            setFolderToMove(null)
                          }
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: '1.25rem',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        minWidth: '32px',
                        minHeight: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#1976d2',
                        borderRadius: '4px',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#e3f2fd'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                      title="Geri"
                    >
                      ←
                    </button>
                  )}
                  <h3 
                    style={{ 
                      fontSize: '1rem', 
                      fontWeight: 'bold', 
                      margin: 0,
                    }}
                  >
                    Papkalar
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    onClick={handleAddFolder}
                    style={{
                      background: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '0.375rem 0.5rem',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      minWidth: '32px',
                      minHeight: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Yeni papka"
                  >
                    ➕
                  </button>
                  {selectedFolder && !moveFolderMode && (
                    <>
                      <button
                        onClick={() => handleEditFolder(selectedFolder)}
                        style={{
                          background: '#ff9800',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          minWidth: '32px',
                          minHeight: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Papka adı düzəlt"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleStartMoveFolderMode(selectedFolder)}
                        style={{
                          background: '#9c27b0',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          minWidth: '32px',
                          minHeight: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Papkanı köçür"
                      >
                        📂
                      </button>
                      <button
                        onClick={() => handleDeleteFolder(selectedFolder)}
                        style={{
                          background: '#d32f2f',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.375rem 0.5rem',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          minWidth: '32px',
                          minHeight: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Papka sil"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                  {moveFolderMode && (
                    <button
                      onClick={handleCancelMoveFolderMode}
                      style={{
                        background: '#d32f2f',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '0.375rem 0.5rem',
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        minWidth: '32px',
                        minHeight: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Papka köçürməni ləğv et"
                    >
                      ✖️
                    </button>
                  )}
                </div>
              </div>

              {/* Breadcrumb Navigation */}
              <div style={{ 
                padding: '0.75rem 1rem', 
                background: '#f5f5f5', 
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                flexShrink: 0,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flex: 1,
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  scrollbarWidth: 'thin',
                  WebkitOverflowScrolling: 'touch',
                  minWidth: 0,
                }}>
                  {folderPath.map((item, index) => (
                    <div 
                      key={item.id || 'root'} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        flexShrink: 0,
                      }}
                    >
                      {index > 0 && (
                        <span style={{ color: '#999', fontSize: '0.75rem', flexShrink: 0 }}>›</span>
                      )}
                      <button
                        onClick={() => {
                          if (moveFolderMode && folderToMove !== null) {
                            handleMoveFolder(item.id)
                          } else if (moveMode) {
                            handleMoveToFolder(item.id)
                          } else {
                            setSelectedFolder(item.id)
                            setSelectedIds(new Set())
                          }
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: index === folderPath.length - 1 ? '#1976d2' : '#666',
                          fontWeight: index === folderPath.length - 1 ? 'bold' : 'normal',
                          cursor: 'pointer',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          textDecoration: 'none',
                          transition: 'background 0.2s',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#e0e0e0'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        {item.name}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Accordion Papka İçi - Scrollable */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  WebkitOverflowScrolling: 'touch',
                }}
              >
                {/* Seçilmiş papkanın içi */}
                {selectedFolder === null ? (
                  // Root - bütün root papkaları və müştəriləri göstər
                  <>
                    {folderTree.map(folder => {
                      // const folderCustomers = customers.filter(c => c.folder_id === folder.id)
                      // const hasCustomers = folderCustomers.length > 0
                      // const hasChildren = folder.children && folder.children.length > 0

                      return (
                        <div key={folder.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                          <div
                            onClick={() => {
                              if (moveFolderMode && folderToMove !== null) {
                                handleMoveFolder(folder.id)
                              } else if (moveMode) {
                                handleMoveToFolder(folder.id)
                              } else {
                                setSelectedFolder(folder.id)
                                setSelectedIds(new Set())
                              }
                            }}
                            style={{
                              padding: '0.75rem 1rem',
                              background: 'white',
                              borderLeft: '3px solid transparent',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              cursor: 'pointer',
                              minHeight: '44px',
                            }}
                          >
                            <span style={{ fontSize: '1.25rem' }}>📁</span>
                            <span style={{ flex: 1, fontSize: '0.875rem', fontWeight: 'normal' }}>
                              {folder.name}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#666' }}>
                              ({getCustomerCountForFolder(folder.id)})
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Bütün müştərilər */}
                    {customers.length > 0 && (
                      <div style={{ padding: '0.5rem' }}>
                        <table
                          style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.875rem',
                            background: 'white',
                            borderRadius: '4px',
                            overflow: 'hidden',
                          }}
                        >
                          <thead>
                            <tr style={{ background: '#f5f5f5' }}>
                              <th
                                style={{
                                  padding: '0.5rem',
                                  textAlign: 'left',
                                  borderBottom: '2px solid #ddd',
                                  borderRight: '1px solid #e0e0e0',
                                  fontWeight: 'bold',
                                  fontSize: '0.8rem',
                                  color: '#333',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={customers.length > 0 && customers.every(c => selectedIds.has(c.id))}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      const newSelected = new Set(selectedIds)
                                      customers.forEach(c => newSelected.add(c.id))
                                      setSelectedIds(newSelected)
                                    } else {
                                      const newSelected = new Set(selectedIds)
                                      customers.forEach(c => newSelected.delete(c.id))
                                      setSelectedIds(newSelected)
                                    }
                                  }}
                                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                              </th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd', borderRight: '1px solid #e0e0e0', fontWeight: 'bold', fontSize: '0.8rem', color: '#333' }}>Kod</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd', borderRight: '1px solid #e0e0e0', fontWeight: 'bold', fontSize: '0.8rem', color: '#333' }}>Ad</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd', borderRight: '1px solid #e0e0e0', fontWeight: 'bold', fontSize: '0.8rem', color: '#333' }}>Telefon</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd', borderRight: '1px solid #e0e0e0', fontWeight: 'bold', fontSize: '0.8rem', color: '#333' }}>Papka</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #ddd', fontWeight: 'bold', fontSize: '0.8rem', color: '#333' }}>Balans</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customers.map((customer) => {
                              const isSelected = selectedIds.has(customer.id)
                              return (
                                <tr
                                  key={customer.id}
                                  onClick={() => handleSelect(customer.id)}
                                  style={{
                                    background: isSelected ? '#e3f2fd' : 'white',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #eee',
                                    transition: 'background 0.2s',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = '#f5f5f5'
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = 'white'
                                  }}
                                >
                                  <td style={{ padding: '0.5rem', textAlign: 'center', borderRight: '1px solid #e0e0e0' }} onClick={(e) => e.stopPropagation()}>
                                    <input type="checkbox" checked={isSelected} onChange={() => handleSelect(customer.id)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                                  </td>
                                  <td style={{ padding: '0.5rem', borderRight: '1px solid #e0e0e0', color: '#666', fontFamily: 'monospace' }}>{customer.code || '-'}</td>
                                  <td style={{ padding: '0.5rem', borderRight: '1px solid #e0e0e0', fontWeight: isSelected ? 'bold' : 'normal' }}>{customer.name}</td>
                                  <td style={{ padding: '0.5rem', borderRight: '1px solid #e0e0e0', color: '#666' }}>{customer.phone || '-'}</td>
                                  <td 
                                    style={{ 
                                      padding: '0.5rem', 
                                      borderRight: '1px solid #e0e0e0', 
                                      color: customer.folder_id ? '#1976d2' : '#666',
                                      cursor: customer.folder_id ? 'pointer' : 'default',
                                      textDecoration: customer.folder_id ? 'underline' : 'none',
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      if (customer.folder_id) {
                                        setSelectedFolder(customer.folder_id)
                                        setSelectedIds(new Set())
                                        if (folderViewMode === 'accordion') {
                                          setFolderOpen(true)
                                        }
                                      }
                                    }}
                                    onContextMenu={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      if (customer.folder_id) {
                                        setContextMenu({
                                          x: e.clientX,
                                          y: e.clientY,
                                          folderId: customer.folder_id,
                                        })
                                      }
                                    }}
                                  >
                                    {getFolderNameForCustomer(customer.folder_id)}
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold', color: customer.balance && customer.balance < 0 ? '#d32f2f' : '#2e7d32' }}>
                                    {customer.balance !== null ? Number(customer.balance).toFixed(2) : '0.00'} ₼
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  // Seçilmiş papkanın içi
                  renderAccordionCurrentFolder()
                )}
              </div>
            </div>
          )}

          {/* Cədvəl - Sidebar rejimində və ya papka bağlı olduqda göstər */}
          {(folderViewMode === 'sidebar' || !folderOpen) && (
          <div
            ref={(el) => {
              if (el) {
                const rect = el.getBoundingClientRect()
                const label = el.querySelector('.debug-label-green') as HTMLElement
                if (label) {
                  label.textContent = `GREEN: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}px`
                }
              }
            }}
            style={{
              flex: 1,
              overflow: 'auto',
              WebkitOverflowScrolling: 'touch',
              background: 'white',
              minWidth: 0,
              maxWidth: '100%',
              width: '100%',
              margin: 0,
              padding: 0,
              border: debugMode ? '3px solid green' : 'none', // DEBUG
              boxSizing: 'border-box',
              position: 'relative',
            }}
          >
            {debugMode && (
            <div className="debug-label-green" style={{
              position: 'absolute',
              top: '2px',
              left: '2px',
              background: 'green',
              color: 'white',
              padding: '2px 4px',
              fontSize: '10px',
              zIndex: 10000,
              fontWeight: 'bold',
            }}>GREEN: Loading...</div>
            )}
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Yüklənir...</div>
            ) : (
              <div 
                ref={(el) => {
                  if (el) {
                    const rect = el.getBoundingClientRect()
                    const bluePanel = el.parentElement?.previousElementSibling as HTMLElement
                    const blueRect = bluePanel?.getBoundingClientRect()
                    const label = el.querySelector('.debug-label-orange') as HTMLElement
                    if (label) {
                      const leftGap = blueRect ? (rect.left - blueRect.right).toFixed(0) : '0'
                      label.textContent = `ORANGE: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}px | Left gap: ${leftGap}px`
                    }
                  }
                }}
                style={{ 
                  overflow: 'visible', 
                  minHeight: '100%', 
                  padding: 0, 
                  margin: 0,
                  width: '100%',
                  maxWidth: '100%',
                  border: debugMode ? '3px solid orange' : 'none', // DEBUG
                  boxSizing: 'border-box',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {debugMode && (
                <div className="debug-label-orange" style={{
                  position: 'absolute',
                  top: '2px',
                  left: '2px',
                  background: 'orange',
                  color: 'white',
                  padding: '2px 4px',
                  fontSize: '10px',
                  zIndex: 10000,
                  fontWeight: 'bold',
                }}>ORANGE: Loading...</div>
                )}
                {/* Breadcrumb Navigation - yalnız papka açıq olduqda göstər */}
                {folderOpen && (
                <div style={{ 
                  padding: folderTreeVisible ? '0.5rem 1rem' : '0.5rem 0.5rem', 
                  background: '#f5f5f5', 
                  borderBottom: '1px solid #e0e0e0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  position: 'relative',
                  flexShrink: 0,
                  minHeight: '40px',
                }}>
                  {/* Breadcrumb scrollable area */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flex: 1,
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    scrollbarWidth: 'thin',
                    WebkitOverflowScrolling: 'touch',
                    minWidth: 0, // Flex item üçün mühüm
                  }}>
                    {folderPath.map((item, index) => (
                      <div 
                        key={item.id || 'root'} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem',
                          flexShrink: 0, // Elementlərin sıxışmasını qadağan et
                        }}
                      >
                        {index > 0 && (
                          <span style={{ color: '#999', fontSize: '0.75rem', flexShrink: 0 }}>›</span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {/* Gizlədilmiş papkalar ikonu - yalnız "Bütün alıcılar" üçün və ağac gizli olduqda */}
                          {index === 0 && !folderTreeVisible && (
                            <button
                              onClick={() => {
                              setFolderTreeVisible(true)
                              localStorage.setItem('folderTreeVisible', 'true')
                            }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                padding: '0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#1976d2',
                                minWidth: '16px',
                                minHeight: '16px',
                                lineHeight: '1',
                              }}
                              title="Papkaları göstər"
                            >
                              ▶
                            </button>
                          )}
                          <button
                          onClick={() => {
                            if (moveFolderMode && folderToMove !== null) {
                              // Papka köçürmə rejimində - papkanı bu papkaya köçür
                              handleMoveFolder(item.id)
                            } else if (moveMode) {
                              // Müştəri köçürmə rejimində - müştəriləri bu papkaya köçür
                              handleMoveToFolder(item.id)
                            } else {
                              // Normal rejim - papkaya keç
                              setSelectedFolder(item.id)
                              setSelectedIds(new Set())
                            }
                          }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: index === folderPath.length - 1 ? '#1976d2' : '#666',
                              fontWeight: index === folderPath.length - 1 ? 'bold' : 'normal',
                              cursor: 'pointer',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.875rem',
                              textDecoration: 'none',
                              transition: 'background 0.2s',
                              whiteSpace: 'nowrap', // Mətnin qırılmaması
                              flexShrink: 0,
                              lineHeight: '1.2',
                            }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#e0e0e0'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent'
                          }}
                        >
                          {item.name}
                        </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Right side: customer count and close button */}
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    flexShrink: 0,
                    marginLeft: '0.5rem',
                  }}>
                    {selectedFolder !== null && (
                      <span style={{ 
                        color: '#666', 
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                      }}>
                        {filteredCustomers.length} müştəri
                      </span>
                    )}
                    {selectedFolder !== null && (
                      <button
                        onClick={() => {
                          setSelectedFolder(null)
                          setSelectedIds(new Set())
                          if (moveMode) {
                            setMoveMode(false)
                          }
                          if (moveFolderMode) {
                            setMoveFolderMode(false)
                            setFolderToMove(null)
                          }
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#666',
                          cursor: 'pointer',
                          padding: '0.25rem',
                          borderRadius: '4px',
                          fontSize: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '24px',
                          minHeight: '24px',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#e0e0e0'
                          e.currentTarget.style.color = '#d32f2f'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = '#666'
                        }}
                        title="Bütün siyahıya qayıt"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                )}
                
                {/* Müştərilər cədvəli və ya boş mesaj */}
                {filteredCustomers.length === 0 ? (
                  <div style={{ 
                    padding: '2rem', 
                    textAlign: 'center', 
                    color: '#666',
                    background: 'white',
                  }}>
                    {selectedFolder === null 
                      ? 'Alıcı tapılmadı'
                      : `Bu papkada alıcı yoxdur`
                    }
              </div>
            ) : (
                <div style={{ 
                  position: 'relative',
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'auto',
                  minHeight: 0,
                }}>
                  {debugMode && (
                  <div className="debug-label-purple" style={{
                    position: 'absolute',
                    top: '2px',
                    left: '2px',
                    background: 'purple',
                    color: 'white',
                    padding: '2px 4px',
                    fontSize: '10px',
                    zIndex: 10000,
                    fontWeight: 'bold',
                  }}>PURPLE: Loading...</div>
                  )}
                <table
                    ref={(el) => {
                      if (el) {
                        const rect = el.getBoundingClientRect()
                        const label = document.querySelector('.debug-label-purple') as HTMLElement
                        if (label) {
                          label.textContent = `PURPLE: ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}px`
                        }
                      }
                    }}
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.875rem',
                    background: 'white',
                      margin: 0,
                      padding: 0,
                      border: debugMode ? '3px solid purple' : 'none', // DEBUG
                      boxSizing: 'border-box',
                  }}
                >
                  <thead>
                    <tr style={{ background: '#f5f5f5', position: 'sticky', top: 0, zIndex: 10 }}>
                      {columnOrder.map((columnKey) => {
                        const config = columnConfig[columnKey]
                        if (!config) return null
                        
                        // Sütun görünürlüyünü yoxla
                        if (!columnVisibility[columnKey]) return null

                        const isCheckbox = columnKey === 'checkbox'
                        const width = columnWidths[columnKey] || (isCheckbox ? 50 : 100)
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
                            onDrop={(e) => handleDrop(e, columnKey)}
                            onClick={() => !isCheckbox && !isDragging && handleSort(columnKey)}
                            style={{
                              padding: isCheckbox 
                                ? (folderTreeVisible ? '0.75rem 0.5rem' : '0.75rem 0.25rem')
                                : '0.75rem',
                              paddingLeft: isCheckbox 
                                ? (folderTreeVisible ? '0.5rem' : '0.25rem')
                                : '0.75rem',
                              textAlign: config.align || 'left',
                              borderBottom: '2px solid #ddd',
                              borderRight: columnKey !== 'balance' ? '1px solid #e0e0e0' : 'none',
                              width: `${width}px`,
                              minWidth: `${width}px`,
                              maxWidth: `${width}px`,
                              fontWeight: 'bold',
                              fontSize: isCheckbox ? '0.8rem' : '0.85rem',
                              color: '#333',
                              whiteSpace: 'nowrap',
                              cursor: isCheckbox ? 'default' : 'pointer',
                              userSelect: 'none',
                              position: 'relative',
                              touchAction: 'none', // Touch event-ləri üçün
                            }}
                          >
                            {isCheckbox ? (
                              <input
                                type="checkbox"
                                checked={selectedIds.size === filteredCustomers.length && filteredCustomers.length > 0}
                                onChange={() => {
                                  if (selectedIds.size === filteredCustomers.length) {
                                    const newSelected = new Set(selectedIds)
                                    filteredCustomers.forEach(c => newSelected.delete(c.id))
                                    setSelectedIds(newSelected)
                                  } else {
                                    const newSelected = new Set(selectedIds)
                                    filteredCustomers.forEach(c => newSelected.add(c.id))
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
                                {config.label}{sortIcon}
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
                    {filteredCustomers.map((customer) => {
                      const isSelected = selectedIds.has(customer.id)
                      return (
                        <tr
                          key={customer.id}
                          onClick={() => handleSelect(customer.id)}
                          style={{
                            background: isSelected ? '#e3f2fd' : 'white',
                            cursor: 'pointer',
                            borderBottom: '1px solid #eee',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = '#f5f5f5'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'white'
                            }
                          }}
                        >
                          {columnOrder.map((columnKey) => {
                            const config = columnConfig[columnKey]
                            if (!config) return null
                            
                            // Sütun görünürlüyünü yoxla
                            if (!columnVisibility[columnKey]) return null

                            const isCheckbox = columnKey === 'checkbox'
                            const width = columnWidths[columnKey] || (isCheckbox ? 50 : 100)

                            let cellContent: React.ReactNode
                            let cellStyle: React.CSSProperties = {
                              padding: isCheckbox 
                                ? (folderTreeVisible ? '0.75rem 0.5rem' : '0.75rem 0.25rem')
                                : '0.75rem',
                              paddingLeft: isCheckbox 
                                ? (folderTreeVisible ? '0.5rem' : '0.25rem')
                                : '0.75rem',
                              textAlign: config.align || 'left',
                              borderRight: columnKey !== 'balance' ? '1px solid #e0e0e0' : 'none',
                              width: `${width}px`,
                              minWidth: `${width}px`,
                              maxWidth: `${width}px`,
                            }

                            if (isCheckbox) {
                              cellContent = (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleSelect(customer.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    cursor: 'pointer',
                                  }}
                                />
                              )
                            } else if (columnKey === 'code') {
                              cellStyle.color = '#666'
                              cellStyle.fontFamily = 'monospace'
                              cellContent = customer.code || '-'
                            } else if (columnKey === 'name') {
                              cellStyle.fontWeight = isSelected ? 'bold' : 'normal'
                              cellContent = customer.name
                            } else if (columnKey === 'phone') {
                              cellStyle.color = '#666'
                              cellContent = customer.phone || '-'
                            } else if (columnKey === 'folder') {
                              cellStyle.color = customer.folder_id ? '#1976d2' : '#666'
                              cellStyle.cursor = customer.folder_id ? 'pointer' : 'default'
                              cellStyle.textDecoration = customer.folder_id ? 'underline' : 'none'
                              cellContent = getFolderNameForCustomer(customer.folder_id)
                            } else if (columnKey === 'balance') {
                              cellStyle.fontWeight = 'bold'
                              cellStyle.color = customer.balance && customer.balance < 0 ? '#d32f2f' : '#2e7d32'
                              cellContent = customer.balance !== null ? Number(customer.balance).toFixed(2) : '0.00'
                              cellContent = `${cellContent} ₼`
                            }

                            return (
                              <td
                                key={columnKey}
                                style={cellStyle}
                                onClick={columnKey === 'folder' && customer.folder_id ? (e) => {
                                  e.stopPropagation()
                                  setSelectedFolder(customer.folder_id)
                                  setSelectedIds(new Set())
                                  if (folderViewMode === 'accordion') {
                                    setFolderOpen(true)
                                  }
                                } : undefined}
                                onContextMenu={columnKey === 'folder' && customer.folder_id ? (e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    folderId: customer.folder_id,
                                  })
                                } : undefined}
                              >
                                {cellContent}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Papka əlavə et modal */}
      {addFolderModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setAddFolderModalOpen(false)
              setNewFolderName('')
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              Yeni papka əlavə et
            </h2>
            {selectedFolder !== null ? (
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
                Seçilmiş papka: <strong>{folders.find(f => f.id === selectedFolder)?.name || 'Naməlum'}</strong>
                <br />
                <span style={{ fontSize: '0.8rem' }}>Yeni papka bu papkanın altına əlavə olunacaq</span>
              </p>
            ) : (
              <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
                Yeni papka kök səviyyədə (root) yaradılacaq
              </p>
            )}
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Papka adı"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveFolder()
                } else if (e.key === 'Escape') {
                  setAddFolderModalOpen(false)
                  setNewFolderName('')
                }
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                border: '1px solid #ddd',
                borderRadius: '6px',
                marginBottom: '1rem',
                minHeight: '44px',
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setAddFolderModalOpen(false)
                  setNewFolderName('')
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  minHeight: '44px',
                }}
              >
                Ləğv et
              </button>
              <button
                onClick={handleSaveFolder}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  minHeight: '44px',
                }}
              >
                Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alıcı əlavə et modal */}
      {addCustomerModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setAddCustomerModalOpen(false)
              setEditingCustomerId(null)
              setNewCustomer({
                code: '',
                name: '',
                phone: '',
                email: '',
                address: '',
                folder_id: selectedFolder,
              })
            }
          }}
          style={{
            position: 'fixed',
            top: isMobile ? '56px' : 0, // Mobil üçün top navbar hündürlüyü
            left: 0,
            right: 0,
            bottom: isMobile ? '60px' : 0, // Mobil üçün bottom navbar hündürlüyü
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'center',
            padding: isMobile ? '0' : '1rem',
            overflowY: 'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: isMobile ? '0' : '8px',
              padding: '1.5rem',
              width: '100%',
              maxWidth: '500px',
              height: isMobile ? '100%' : 'auto', // Mobil üçün tam hündürlük (navbar-lar arası)
              maxHeight: isMobile ? '100%' : '90vh',
              overflowY: 'auto',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              position: 'relative',
              zIndex: 10001,
              marginTop: isMobile ? '0' : 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              {editingCustomerId !== null ? 'Alıcını redaktə et' : 'Yeni alıcı əlavə et'}
            </h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                value={newCustomer.code}
                onChange={(e) => setNewCustomer({ ...newCustomer, code: e.target.value })}
                placeholder={editingCustomerId === null ? "Kod (avtomatik generasiya olunacaq)" : "Kod"}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  minHeight: '44px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                placeholder="Ad *"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSaveCustomer()
                  } else if (e.key === 'Escape') {
                    setAddCustomerModalOpen(false)
                    setEditingCustomerId(null)
                    setNewCustomer({
                      code: '',
                      name: '',
                      phone: '',
                      email: '',
                      address: '',
                      folder_id: selectedFolder,
                    })
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  minHeight: '44px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <input
                type="tel"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="Telefon"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  minHeight: '44px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <input
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                placeholder="Email"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  minHeight: '44px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <textarea
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                placeholder="Ünvan"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <select
                value={newCustomer.folder_id || ''}
                onChange={(e) => setNewCustomer({ ...newCustomer, folder_id: e.target.value ? parseInt(e.target.value) : null })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  minHeight: '44px',
                  boxSizing: 'border-box',
                  background: 'white',
                  cursor: 'pointer',
                  color: newCustomer.folder_id ? 'inherit' : '#999',
                }}
              >
                <option value="" style={{ color: '#999' }}>Papka</option>
                {(() => {
                  const folderTree = buildFolderTree(folders)
                  const renderFolderOptions = (folderList: Folder[], level: number = 0): React.ReactNode[] => {
                    const options: React.ReactNode[] = []
                    folderList.forEach(folder => {
                      const indent = '  '.repeat(level)
                      options.push(
                        <option key={folder.id} value={folder.id}>
                          {indent}{folder.name}
                        </option>
                      )
                      if (folder.children && folder.children.length > 0) {
                        options.push(...renderFolderOptions(folder.children, level + 1))
                      }
                    })
                    return options
                  }
                  return renderFolderOptions(folderTree)
                })()}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', marginTop: '1.5rem', flexWrap: 'nowrap' }}>
              <button
                onClick={() => {
                  setAddCustomerModalOpen(false)
                  setEditingCustomerId(null)
                  setNewCustomer({
                    code: '',
                    name: '',
                    phone: '',
                    email: '',
                    address: '',
                    folder_id: selectedFolder,
                  })
                }}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  background: '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  minHeight: '44px',
                }}
              >
                Ləğv et
              </button>
              {editingCustomerId === null && (
                <>
                  <button
                    onClick={() => handleSaveCustomer(false)}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      background: '#ff9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      minHeight: '44px',
                    }}
                  >
                    Yadda saxla
                  </button>
                  <button
                    onClick={() => handleSaveCustomer(true)}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1rem',
                      background: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      minHeight: '44px',
                    }}
                  >
                    OK
                  </button>
                </>
              )}
              {editingCustomerId !== null && (
                <button
                  onClick={() => handleSaveCustomer(true)}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1rem',
                    background: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    minHeight: '44px',
                  }}
                >
                  Yadda saxla
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Ayarlar Modal */}
      {settingsModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSettingsModalOpen(false)
            }
          }}
          style={{
            position: 'fixed',
            top: isMobile ? '56px' : 0, // Mobil üçün top navbar hündürlüyü
            left: 0,
            right: 0,
            bottom: isMobile ? '60px' : 0, // Mobil üçün bottom navbar hündürlüyü
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: isMobile ? 'stretch' : 'center',
            justifyContent: 'center',
            padding: isMobile ? '0' : '1rem',
            overflowY: 'auto',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: isMobile ? '0' : '8px',
              padding: '0',
              width: '100%',
              maxWidth: '600px',
              height: isMobile ? '100%' : 'auto', // Mobil üçün tam hündürlük (navbar-lar arası)
              maxHeight: isMobile ? '100%' : '80vh',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
              zIndex: 10001,
              marginTop: isMobile ? '0' : 'auto',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>
                Cədvəl ayarları
              </h2>
              <button
                onClick={() => setSettingsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0.25rem',
                  minWidth: '32px',
                  minHeight: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid #e0e0e0',
                background: '#f5f5f5',
              }}
            >
              <button
                onClick={() => setSettingsTab('columns')}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  background: settingsTab === 'columns' ? 'white' : 'transparent',
                  border: 'none',
                  borderBottom: settingsTab === 'columns' ? '2px solid #1976d2' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: settingsTab === 'columns' ? 'bold' : 'normal',
                  color: settingsTab === 'columns' ? '#1976d2' : '#666',
                }}
              >
                Sütunlar
              </button>
              <button
                onClick={() => setSettingsTab('functions')}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  background: settingsTab === 'functions' ? 'white' : 'transparent',
                  border: 'none',
                  borderBottom: settingsTab === 'functions' ? '2px solid #1976d2' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: settingsTab === 'functions' ? 'bold' : 'normal',
                  color: settingsTab === 'functions' ? '#1976d2' : '#666',
                }}
              >
                Funksiyalar
              </button>
            </div>

            {/* Tab Content */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '1.5rem',
                minHeight: 0, // Flex item scroll üçün lazımdır
              }}
            >
              {settingsTab === 'columns' && (
                <div>
                  {/* Varsayılanlara qaytar düyməsi */}
                  <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                      onClick={handleResetToDefaults}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        background: '#f5f5f5',
                        border: '1px solid #e0e0e0',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        color: '#333',
                      }}
                    >
                      <span>🔄</span>
                      <span>Varsayılanlara qaytar</span>
                    </button>
                  </div>

                  {/* Sütunlar cədvəli */}
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', fontSize: '0.875rem' }}>Sütun</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', fontSize: '0.875rem' }}>Göstər</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', fontSize: '0.875rem' }}>Genişlik</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', fontSize: '0.875rem' }}>Yer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {columnOrder.map((columnKey, index) => {
                          const config = columnConfig[columnKey]
                          if (!config) return null
                          const isFirst = index === 0
                          const isLast = index === columnOrder.length - 1
                          
                          return (
                            <tr key={columnKey} style={{ borderBottom: '1px solid #e0e0e0' }}>
                              <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                                {config.label}
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={columnVisibility[columnKey] ?? true}
                                  onChange={(e) => {
                                    setColumnVisibility(prev => ({
                                      ...prev,
                                      [columnKey]: e.target.checked
                                    }))
                                  }}
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    cursor: 'pointer',
                                    accentColor: '#1976d2',
                                  }}
                                />
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                                  <input
                                    type="number"
                                    value={columnWidths[columnKey] || 100}
                                    onChange={(e) => {
                                      const newWidth = parseInt(e.target.value) || 50
                                      setColumnWidths(prev => ({
                                        ...prev,
                                        [columnKey]: Math.max(50, newWidth)
                                      }))
                                    }}
                                    style={{
                                      width: '60px',
                                      padding: '0.25rem 0.5rem',
                                      border: '1px solid #e0e0e0',
                                      borderRadius: '4px',
                                      fontSize: '0.875rem',
                                      textAlign: 'center',
                                    }}
                                  />
                                  <span style={{ fontSize: '0.875rem', color: '#666' }}>px</span>
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                                  <button
                                    onClick={() => handleMoveColumn(columnKey, 'up')}
                                    disabled={isFirst}
                                    style={{
                                      background: isFirst ? '#f5f5f5' : '#1976d2',
                                      color: isFirst ? '#ccc' : 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      width: '28px',
                                      height: '24px',
                                      cursor: isFirst ? 'not-allowed' : 'pointer',
                                      fontSize: '0.75rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      opacity: isFirst ? 0.5 : 1,
                                    }}
                                  >
                                    ▲
                                  </button>
                                  <button
                                    onClick={() => handleMoveColumn(columnKey, 'down')}
                                    disabled={isLast}
                                    style={{
                                      background: isLast ? '#f5f5f5' : '#1976d2',
                                      color: isLast ? '#ccc' : 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      width: '28px',
                                      height: '24px',
                                      cursor: isLast ? 'not-allowed' : 'pointer',
                                      fontSize: '0.75rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      opacity: isLast ? 0.5 : 1,
                                    }}
                                  >
                                    ▼
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {settingsTab === 'functions' && (
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                    Navbar Gesture Ayarları
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                    {/* Yuxarı Navbar Gesture */}
                    <div style={{ 
                      padding: '1rem', 
                      border: '1px solid #e0e0e0', 
                      borderRadius: '8px',
                      background: 'white',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}>
                          Yuxarı Navbar Gesture
                        </label>
                        <label style={{ 
                          position: 'relative', 
                          display: 'inline-block', 
                          width: '50px', 
                          height: '26px',
                          cursor: 'pointer',
                        }}>
                          <input
                            type="checkbox"
                            checked={topNavbarGestureEnabled}
                            onChange={(e) => setTopNavbarGestureEnabled(e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                          />
                          <span style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: topNavbarGestureEnabled ? '#1976d2' : '#ccc',
                            transition: '0.3s',
                            borderRadius: '26px',
                          }}>
                            <span style={{
                              position: 'absolute',
                              content: '""',
                              height: '20px',
                              width: '20px',
                              left: '3px',
                              bottom: '3px',
                              backgroundColor: 'white',
                              transition: '0.3s',
                              borderRadius: '50%',
                              transform: topNavbarGestureEnabled ? 'translateX(24px)' : 'translateX(0)',
                            }} />
                          </span>
                        </label>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>
                        Yuxarı navbar-ı scroll gesture ilə gizlətmək/göstərmək
                      </p>
                    </div>
                    
                    {/* Aşağı Navbar Gesture */}
                    <div style={{ 
                      padding: '1rem', 
                      border: '1px solid #e0e0e0', 
                      borderRadius: '8px',
                      background: 'white',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer' }}>
                          Aşağı Navbar Gesture
                        </label>
                        <label style={{ 
                          position: 'relative', 
                          display: 'inline-block', 
                          width: '50px', 
                          height: '26px',
                          cursor: 'pointer',
                        }}>
                          <input
                            type="checkbox"
                            checked={bottomNavbarGestureEnabled}
                            onChange={(e) => setBottomNavbarGestureEnabled(e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                          />
                          <span style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: bottomNavbarGestureEnabled ? '#1976d2' : '#ccc',
                            transition: '0.3s',
                            borderRadius: '26px',
                          }}>
                            <span style={{
                              position: 'absolute',
                              content: '""',
                              height: '20px',
                              width: '20px',
                              left: '3px',
                              bottom: '3px',
                              backgroundColor: 'white',
                              transition: '0.3s',
                              borderRadius: '50%',
                              transform: bottomNavbarGestureEnabled ? 'translateX(24px)' : 'translateX(0)',
                            }} />
                          </span>
                        </label>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>
                        Aşağı navbar-ı scroll gesture ilə gizlətmək/göstərmək
                      </p>
                    </div>
                  </div>
                  
                  <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                    Papka görünüşü
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label 
                      onClick={() => {
                        setFolderViewMode('sidebar')
                        localStorage.setItem('folderViewMode', 'sidebar')
                      }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        fontSize: '0.875rem', 
                        cursor: 'pointer',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        border: folderViewMode === 'sidebar' ? '2px solid #1976d2' : '2px solid #e0e0e0',
                        background: folderViewMode === 'sidebar' ? '#e3f2fd' : 'white',
                      }}
                    >
                      <input 
                        type="radio" 
                        name="folderView"
                        checked={folderViewMode === 'sidebar'}
                        onChange={() => {
                          setFolderViewMode('sidebar')
                          localStorage.setItem('folderViewMode', 'sidebar')
                        }}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Sol tərəfdə açılsın</div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>Papkalar sol tərəfdə panel kimi göstərilir</div>
                      </div>
                    </label>
                    <label 
                      onClick={() => {
                        setFolderViewMode('accordion')
                        localStorage.setItem('folderViewMode', 'accordion')
                      }}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        fontSize: '0.875rem', 
                        cursor: 'pointer',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        border: folderViewMode === 'accordion' ? '2px solid #1976d2' : '2px solid #e0e0e0',
                        background: folderViewMode === 'accordion' ? '#e3f2fd' : 'white',
                      }}
                    >
                      <input 
                        type="radio" 
                        name="folderView"
                        checked={folderViewMode === 'accordion'}
                        onChange={() => {
                          setFolderViewMode('accordion')
                          localStorage.setItem('folderViewMode', 'accordion')
                        }}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Alt-alta açılsın</div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>Papkalar alt-alta accordion kimi göstərilir</div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                onClick={() => setSettingsModalOpen(false)}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: '#1976d2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                }}
              >
                Bağla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kontekst Menyu */}
      {contextMenu && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setContextMenu(null)
            }
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 3000,
            background: 'transparent',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: `${contextMenu.y}px`,
              left: `${contextMenu.x}px`,
              background: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              minWidth: '150px',
              zIndex: 3001,
            }}
          >
            <button
              onClick={() => {
                if (contextMenu.folderId !== null) {
                  setSelectedFolder(contextMenu.folderId)
                  setSelectedIds(new Set())
                  if (folderViewMode === 'accordion') {
                    setFolderOpen(true)
                  }
                }
                setContextMenu(null)
              }}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '0.875rem',
                color: '#333',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f5f5f5'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              📁 Papkaya keç
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </Layout>
  )
}
