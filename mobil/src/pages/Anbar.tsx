import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import Toast from '../components/Toast'
import { productsAPI, categoriesAPI, clientLog } from '../services/api'
import type { Product } from '@shared/types'
import { Html5Qrcode } from 'html5-qrcode'
import BarcodeImageCropper from '../components/BarcodeImageCropper'

type ExtendedProduct = Product & {
  folder_id?: number | null
  quantity?: number
  purchase_total?: number
  sale_total?: number
}

interface Folder {
  id: number
  name: string
  parent_id: number | null
  children?: Folder[]
  product_count?: number
}

export default function Alicilar() {
  const [products, setProducts] = useState<ExtendedProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [folderOpen, setFolderOpen] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set())
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null)
  const [addFolderModalOpen, setAddFolderModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [addProductModalOpen, setAddProductModalOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState<number | null>(null) // Redaktə edilən məhsul ID
  const [newProduct, setNewProduct] = useState({
    code: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    folder_id: null as number | null,
    article: '',
    barcode: '',
    description: '',
    unit: 'ədəd',
    purchase_price: '',
    sale_price: '',
    type: '',
    brand: '',
    model: '',
    color: '',
    country: '',
    manufacturer: '',
    production_date: '',
    expiry_date: '',
  })

  // Barkod oxuma üçün state və referanslar
  const [barcodeScannerVisible, setBarcodeScannerVisible] = useState(false)
  const [cameraConfirmDone, setCameraConfirmDone] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cameraPermissionConfirmed') === 'true'
    } catch {
      return false
    }
  })
  const barcodeScannerRef = useRef<any>(null)
  const [imageCropOpen, setImageCropOpen] = useState(false)
  const [imageCropFile, setImageCropFile] = useState<File | null>(null)

  const stopBarcodeScanner = async () => {
    if (barcodeScannerRef.current) {
      try {
        await barcodeScannerRef.current.stop()
        barcodeScannerRef.current.clear()
      } catch (err) {
        console.error('Barkod oxuyucu dayandırılarkən xəta:', err)
        clientLog('error', 'Barkod oxuyucu dayandırılarkən xəta', { error: String(err) })
      }
      barcodeScannerRef.current = null
    }
    setBarcodeScannerVisible(false)
  }

  // Barkod oxuma funksiyaları
  const handleBarcodeScanFromCamera = async () => {
    try {
      // Brauzer kamera API dəstəkləyirmi?
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Bu brauzer kameradan istifadəni dəstəkləmir. Zəhmət olmasa başqa brauzer ilə yoxlayın.')
        return
      }

      // Cihazda ümumiyyətlə kamera varmı?
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const hasVideoInput = devices.some(d => d.kind === 'videoinput')
        if (!hasVideoInput) {
          alert('Bu cihazda kamera tapılmadı və ya brauzer onu görə bilmir.')
          return
        }
      } catch (e) {
        console.warn('Kamera cihazları yoxlanarkən xəta:', e)
      }

      // Öz icazə soruşma pəncərəmiz – yalnız birinci dəfə
      if (!cameraConfirmDone) {
        const allow = window.confirm('Kamera istifadə etmək üçün icazə verirsiniz?')
        if (!allow) {
          return
        }
        setCameraConfirmDone(true)
        try {
          localStorage.setItem('cameraPermissionConfirmed', 'true')
        } catch {
          // ignore
        }
      }

      // Kamera preview sahəsini göstər
      setBarcodeScannerVisible(true)

      if (barcodeScannerRef.current) {
        // Artıq aktivdirsə, təkrar başlatma
        return
      }

      const html5QrCode = new Html5Qrcode('mobile-barcode-reader')
      barcodeScannerRef.current = html5QrCode

      try {
        // Daha sürətli və stabil oxu üçün parametrlər
        const scanConfig = {
          fps: 18, // saniyədə kadr sayı – 10-dan bir az yüksək
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            // Görüntünün təxminən 60%-i qədər kvadrat sahə seç
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
            const size = Math.floor(minEdge * 0.6)
            return { width: size, height: size }
          },
          // Arxa kamera üçün mirroring lazım deyil – performansı bir az yaxşılaşdırır
          disableFlip: true,
        } as any

        await html5QrCode.start(
          { facingMode: 'environment' },
          scanConfig,
          (decodedText: string) => {
            // Barkodu forma yaz
            setNewProduct(prev => ({ ...prev, barcode: decodedText }))
            // Skanneri bağla
            stopBarcodeScanner()
          },
          (_errorMessage: string) => {
            // Hər frame üçün error-ları susdururuq
          },
        )
      } catch (err: any) {
        console.error('Barkod oxuyucu başladılarkən xəta:', err)
        clientLog('error', 'Barkod oxuyucu başladılarkən xəta', {
          message: err?.message,
          name: err?.name,
          code: (err as any).code,
        })
        // Xüsusi mesajlar
        if (err?.name === 'NotAllowedError') {
          alert('Kameraya icazə verilmədi. Brauzerin kamera icazə parametrlərini yoxlayın.')
        } else if (err?.name === 'NotFoundError') {
          alert('Kamera cihazı tapılmadı. Cihazda kamera olduğuna və bu brauzerin onu görə bildiyinə əmin olun.')
        } else {
          alert('Barkod oxuyucu başladılarkən xəta: ' + err.message)
        }
        await stopBarcodeScanner()
      }
    } catch (err: any) {
      console.error('Kamera istifadəsi mümkün deyil:', err)
      clientLog('error', 'Kamera istifadəsi mümkün deyil', {
        message: err?.message,
        name: err?.name,
        code: (err as any).code,
      })
      alert('Kamera istifadəsi mümkün deyil: ' + err.message)
      await stopBarcodeScanner()
    }
  }

  const handleBarcodeChange = (barcode: string) => {
    // Yalnız barkodu yenilə, kodu mal təsdiqlənəndə (yadda saxla düyməsində) avtomatik veririk
    setNewProduct(prev => ({
      ...prev,
      barcode,
    }))
  }

  const handleBarcodeScanFromGallery = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      setImageCropFile(file)
      setImageCropOpen(true)
    }
    input.click()
  }

  // Avtomatik barkod generator (web Anbar ilə eyni məntiq)
  const generateBarcode = () => {
    const timestamp = Date.now().toString()
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')
    return `BC${timestamp.slice(-8)}${random}`
  }

  // Mövcud barkodları nəzərə alaraq unikal barkod yarat
  const handleAutoGenerateBarcode = () => {
    const existingBarcodes = products.map(p => p.barcode).filter(Boolean) as string[]
    let newBarcode = generateBarcode()

    while (existingBarcodes.includes(newBarcode)) {
      newBarcode = generateBarcode()
    }

    handleBarcodeChange(newBarcode)
  }

  // Barkod seçim menyusu üçün state
  const [barcodeOptionsOpen, setBarcodeOptionsOpen] = useState(false)

  // Qalereya və Avto barkod seçimləri üçün menyu aç
  const handleBarcodeOptionsClick = () => {
    setBarcodeOptionsOpen(prev => !prev)
  }

  const handleBarcodeOptionGallery = () => {
    setBarcodeOptionsOpen(false)
    handleBarcodeScanFromGallery()
  }

  const handleBarcodeOptionAuto = () => {
    setBarcodeOptionsOpen(false)
    handleAutoGenerateBarcode()
  }

  // Məhsul modalı üçün tab sistemi: əsas məlumatlar / malın IDS-i (əlavə məlumatlar)
  const [productModalTab, setProductModalTab] = useState<'basic' | 'details'>('basic')
  const [moveMode, setMoveMode] = useState(false) // Müştəri köçürmə rejimi
  const [moveFolderMode, setMoveFolderMode] = useState(false) // Papka köçürmə rejimi
  const [folderToMove, setFolderToMove] = useState<number | null>(null) // Köçürüləcək papka
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false) // Ayarlar modalı
  const [settingsTab, setSettingsTab] = useState<'columns' | 'functions'>('columns') // Ayarlar tab
  // Navbar görünürlüyü üçün local state (Layout ilə localStorage və window vasitəsilə sinxronlaşdırılır)
  const [topNavbarVisible, setTopNavbarVisible] = useState(() => {
    const saved = localStorage.getItem('topNavbarVisible')
    return saved !== null ? saved === 'true' : true
  })
  const [bottomNavbarVisible, setBottomNavbarVisible] = useState(() => {
    const saved = localStorage.getItem('bottomNavbarVisible')
    return saved !== null ? saved === 'true' : true
  })
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const baseVisibility = {
      checkbox: true,
      rowNumber: true,
      id: true,
      name: true,
      code: true,
      barcode: true,
      unit: true,
      purchase_price: true,
      sale_price: true,
      quantity: true,
      purchase_total: true,
      sale_total: true,
    }
    const saved = localStorage.getItem('productTableColumnVisibility')
    if (!saved) return baseVisibility
    try {
      const parsed = JSON.parse(saved)
      return { ...baseVisibility, ...parsed }
    } catch {
      return baseVisibility
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
  const [debugMode] = useState(false) // Debug mode - defolt olaraq gizlidir
  const [isMobile, setIsMobile] = useState(false) // Mobil cihaz yoxlaması
  const [rowsPerPage, setRowsPerPage] = useState(() => {
    const saved = localStorage.getItem('productTableRowsPerPage')
    const parsed = saved ? parseInt(saved, 10) : 10
    if (!Number.isFinite(parsed)) return 10
    return Math.min(Math.max(parsed, 5), 50) // 5-50 arası
  })
  const [rowsPerPageInput, setRowsPerPageInput] = useState<string>(() => String(rowsPerPage))
  
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
    const defaultOrder = [
      'checkbox',
      'rowNumber',
      'id',
      'name',
      'code',
      'barcode',
      'unit',
      'purchase_price',
      'sale_price',
      'quantity',
      'purchase_total',
      'sale_total',
    ]
    const saved = localStorage.getItem('productTableColumnOrder')
    if (!saved) return defaultOrder
    try {
      const parsed = JSON.parse(saved)
      // Əgər köhnə config-dirsə (məsələn, id sütunu yoxdur), yeni default-u istifadə et
      if (!Array.isArray(parsed) || !parsed.includes('id')) {
        return defaultOrder
      }
      return parsed
    } catch {
      return defaultOrder
    }
  })
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const baseWidths: Record<string, number> = {
      checkbox: 50,
      rowNumber: 60,
      id: 60,
      name: 200,
      code: 110,
      barcode: 150,
      unit: 80,
      purchase_price: 120,
      sale_price: 120,
      quantity: 90,
      purchase_total: 120,
      sale_total: 120,
    }
    const saved = localStorage.getItem('productTableColumnWidths')
    if (!saved) return baseWidths
    try {
      const parsed = JSON.parse(saved)
      return { ...baseWidths, ...parsed }
    } catch {
      return baseWidths
    }
  })
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(() => {
    const saved = localStorage.getItem('productTableSortConfig')
    return saved ? JSON.parse(saved) : null
  })
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [_touchStartX, setTouchStartX] = useState<number | null>(null)
  const [_touchStartColumn, setTouchStartColumn] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const thRefs = useRef<Map<string, HTMLTableCellElement>>(new Map())
  const toolbarRef = useRef<HTMLDivElement>(null)
  const searchPanelRef = useRef<HTMLDivElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const folderPanelRef = useRef<HTMLDivElement>(null)
  const tableBodyScrollRef = useRef<HTMLDivElement>(null)
  const tableTouchStartYRef = useRef<number | null>(null)
  const [toolbarHeight, setToolbarHeight] = useState(60)
  const [searchPanelHeight, setSearchPanelHeight] = useState(0)
  const [filterPanelHeight, setFilterPanelHeight] = useState(0)
  const [folderPanelHeight, setFolderPanelHeight] = useState(0)

  useEffect(() => {
    loadProducts()
    loadFolders()
  }, [])

  // iOS Safari-də cədvəli dartanda səhifənin özü “rezin” kimi qaçmasın deyə
  // daxili scroll konteynerində overscroll-u JS ilə bloklayırıq
  useEffect(() => {
    const el = tableBodyScrollRef.current
    if (!el) return

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        tableTouchStartYRef.current = e.touches[0].clientY
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (tableTouchStartYRef.current == null) return
      if (e.touches.length === 0) return

      const currentY = e.touches[0].clientY
      const diffY = currentY - tableTouchStartYRef.current

      const scrollTop = el.scrollTop
      const maxScroll = el.scrollHeight - el.clientHeight
      const atTop = scrollTop <= 0
      const atBottom = scrollTop >= maxScroll

      // Yuxarı hissədə aşağıya doğru dartma və ya aşağı hissədə yuxarıya dartma zamanı
      // default davranışı bloklayırıq ki, parent scroll (səhifə) hərəkət etməsin
      if ((atTop && diffY > 0) || (atBottom && diffY < 0)) {
        e.preventDefault()
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
    }
  }, [])

  // Toolbar və panellərin hündürlüyünü hesabla
  useEffect(() => {
    const updateHeights = () => {
      if (toolbarRef.current) {
        setToolbarHeight(toolbarRef.current.offsetHeight)
      }
      if (searchPanelRef.current && searchOpen) {
        setSearchPanelHeight(searchPanelRef.current.offsetHeight)
      } else {
        setSearchPanelHeight(0)
      }
      if (filterPanelRef.current && filterOpen) {
        setFilterPanelHeight(filterPanelRef.current.offsetHeight)
      } else {
        setFilterPanelHeight(0)
      }
      // Papka panelinin hündürlüyünü hesabla
      if (folderPanelRef.current && folderOpen) {
        setFolderPanelHeight(folderPanelRef.current.offsetHeight)
      } else {
        setFolderPanelHeight(0)
      }
    }
    setTimeout(updateHeights, 0)
    window.addEventListener('resize', updateHeights)
    return () => window.removeEventListener('resize', updateHeights)
  }, [searchOpen, filterOpen, folderOpen])

  // Sütun konfiqurasiyasını localStorage-a yaz
  useEffect(() => {
    localStorage.setItem('productTableColumnOrder', JSON.stringify(columnOrder))
  }, [columnOrder])

  useEffect(() => {
    localStorage.setItem('productTableColumnWidths', JSON.stringify(columnWidths))
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
    // React-in touch event listener-ləri bəzi brauzerlərdə passive ola bilər,
    // ona görə burada preventDefault çağırmırıq (xəta verməsin deyə), yalnız
    // document səviyyəsində əlavə etdiyimiz non-passive listener-də istifadə edirik.
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
  const columnConfig: Record<string, { label: string; align?: 'left' | 'right' | 'center'; render?: (product: ExtendedProduct) => React.ReactNode }> = {
    checkbox: { label: '', align: 'center' },
    rowNumber: { label: '№', align: 'center' },
    id: { label: 'ID', align: 'center' },
    name: { label: 'Məhsul adı', align: 'left' },
    code: { label: 'Kod', align: 'left' },
    barcode: { label: 'Barkod', align: 'left' },
    unit: { label: 'Vahid', align: 'left' },
    purchase_price: { label: 'Alış qiyməti', align: 'right' },
    sale_price: { label: 'Satış qiyməti', align: 'right' },
    quantity: { label: 'Qalıq', align: 'right' },
    purchase_total: { label: 'Alış cəm', align: 'right' },
    sale_total: { label: 'Satış cəm', align: 'right' },
  }

  // Sütun görünürlüyünü localStorage-a yaz
  useEffect(() => {
    localStorage.setItem('productTableColumnVisibility', JSON.stringify(columnVisibility))
  }, [columnVisibility])

  // Varsayılanlara qaytar
  const handleResetToDefaults = () => {
    const defaultOrder = [
      'checkbox',
      'rowNumber',
      'id',
      'name',
      'code',
      'barcode',
      'unit',
      'purchase_price',
      'sale_price',
      'quantity',
      'purchase_total',
      'sale_total',
    ]
    const defaultWidths = {
      checkbox: 50,
      rowNumber: 60,
      id: 60,
      name: 200,
      code: 110,
      barcode: 150,
      unit: 80,
      purchase_price: 120,
      sale_price: 120,
      quantity: 90,
      purchase_total: 120,
      sale_total: 120,
    }
    const defaultVisibility = {
      checkbox: true,
      rowNumber: true,
      id: true,
      name: true,
      code: true,
      barcode: true,
      unit: true,
      purchase_price: true,
      sale_price: true,
      quantity: true,
      purchase_total: true,
      sale_total: true,
    }
    setColumnOrder(defaultOrder)
    setColumnWidths(defaultWidths)
    setColumnVisibility(defaultVisibility)
    setSortConfig(null)
    localStorage.setItem('productTableColumnOrder', JSON.stringify(defaultOrder))
    localStorage.setItem('productTableColumnWidths', JSON.stringify(defaultWidths))
    localStorage.setItem('productTableColumnVisibility', JSON.stringify(defaultVisibility))
    localStorage.removeItem('productTableSortConfig')
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
      const data = await categoriesAPI.getAll()
      setFolders(data)
    } catch (error: any) {
      console.error('Papkalar yüklənərkən xəta:', error)
      // Network error varsa, backend server işləmir
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        console.warn('Backend server işləmir. Zəhmət olmasa backend-i başlatın.')
      }
    }
  }

  const loadProducts = async () => {
    try {
      setLoading(true)
      const data = await productsAPI.getAll()
      // category_id sahəsini local olaraq folder_id kimi də saxla
      const extended: ExtendedProduct[] = data.map(p => ({
        ...p,
        folder_id: p.category_id,
      }))
      setProducts(extended)
    } catch (error: any) {
      console.error('Məhsullar yüklənərkən xəta:', error)
      // Network error varsa, backend server işləmir
      if (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')) {
        console.warn('Backend server işləmir. Zəhmət olmasa backend-i başlatın.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (id: number, event?: React.MouseEvent) => {
    const newSelected = new Set(selectedIds)
    const isCtrlPressed = event?.ctrlKey || event?.metaKey // Mac üçün Cmd düyməsi
    
    if (isCtrlPressed) {
      // Ctrl basılıbsa, mövcud seçimləri saxlayıb yenisini əlavə et və ya çıxar
      if (newSelected.has(id)) {
        newSelected.delete(id)
      } else {
        newSelected.add(id)
      }
    } else {
      // Ctrl basılmamışdırsa, yalnız bu sətiri seç (və ya seçimdən çıxar)
      if (newSelected.has(id)) {
        newSelected.delete(id)
      } else {
        newSelected.clear()
        newSelected.add(id)
      }
    }
    setSelectedIds(newSelected)
  }

  const handleAdd = () => {
    // Seçilmiş papkanı default olaraq təyin et
    setEditingProductId(null) // Yeni məhsul rejimi
    setNewProduct({
      code: '', // Kod avtomatik generasiya oluna bilər
      name: '',
      phone: '',
      email: '',
      address: '',
      folder_id: selectedFolder,
      article: '',
      barcode: '',
      description: '',
      unit: 'ədəd',
      purchase_price: '',
      sale_price: '',
      type: '',
      brand: '',
      model: '',
      color: '',
      country: '',
      manufacturer: '',
      production_date: '',
      expiry_date: '',
    })
    setAddProductModalOpen(true)
  }

  const handleEdit = () => {
    if (selectedIds.size !== 1) {
      setToast({ message: 'Zəhmət olmasa redaktə etmək üçün bir müştəri seçin', type: 'info' })
      return
    }

    const productId = Array.from(selectedIds)[0]
    const product = products.find(c => c.id === productId)
    
    if (!product) {
      setToast({ message: 'Məhsul tapılmadı', type: 'error' })
      return
    }

    // Məhsul məlumatlarını form-a yüklə
    // Tarixləri formatla (YYYY-MM-DD)
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

    setNewProduct({
      code: product.code || '',
      name: product.name || '',
      phone: '',
      email: '',
      address: '',
      folder_id: (product as ExtendedProduct).folder_id ?? product.category_id ?? selectedFolder,
      article: product.article || '',
      barcode: product.barcode || '',
      description: product.description || '',
      unit: product.unit || 'ədəd',
      purchase_price: product.purchase_price?.toString() || '',
      sale_price: product.sale_price?.toString() || '',
      type: product.type || '',
      brand: product.brand || '',
      model: product.model || '',
      color: product.color || '',
      country: product.country || '',
      manufacturer: product.manufacturer || '',
      production_date: productionDateStr,
      expiry_date: expiryDateStr,
    })
    setEditingProductId(productId)
    setAddProductModalOpen(true)
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
        productsAPI.delete(String(id))
      )
      
      await Promise.all(deletePromises)

      // Products state-dən sil
      setProducts(products.filter(c => !selectedIds.has(c.id)))
      
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
    // Yalnız bir məhsulu kopyalamağa icazə ver
    if (selectedIds.size === 0) {
      setToast({ message: 'Zəhmət olmasa kopyalamaq üçün bir məhsul seçin', type: 'info' })
      return
    }
    if (selectedIds.size > 1) {
      setToast({ message: 'Kopyalamaq üçün yalnız bir məhsul seçə bilərsiniz', type: 'info' })
      return
    }

    const productId = Array.from(selectedIds)[0]
    const original = products.find(c => c.id === productId)

    if (!original) {
      setToast({ message: 'Məhsul tapılmadı', type: 'error' })
      return
    }

    // Redaktə rejimi deyil, yeni məhsul kimi aç (kod boş olsun)
    setEditingProductId(null)
    setNewProduct({
      code: '', // Kopyalananda kod boş olsun
      name: original.name || '',
      phone: '',
      email: '',
      address: '',
      folder_id: (original as ExtendedProduct).folder_id ?? original.category_id ?? selectedFolder ?? null,
      article: original.article || '',
      barcode: '', // Kopyalananda barkod da boş olsun, yadda saxlayanda avto yaransın
      description: original.description || '',
      unit: original.unit || 'ədəd',
      purchase_price: original.purchase_price?.toString() || '',
      sale_price: original.sale_price?.toString() || '',
      type: original.type || '',
      brand: original.brand || '',
      model: original.model || '',
      color: original.color || '',
      country: original.country || '',
      manufacturer: original.manufacturer || '',
      production_date: (() => {
        if (original.production_date) {
          try {
            const prodDate = new Date(original.production_date)
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
        if (original.expiry_date) {
          try {
            const expDate = new Date(original.expiry_date)
            if (!isNaN(expDate.getTime())) {
              return expDate.toISOString().split('T')[0]
            }
          } catch (e) {
            console.error('Expiry date parse error:', e)
          }
        }
        return ''
      })(),
    })
    setAddProductModalOpen(true)
    setToast({ message: 'Məhsul kopyalandı, yeni kodla yadda saxlaya bilərsiniz', type: 'info' })
  }

  const handleRefresh = () => {
    loadProducts()
  }

  const handleSearch = () => {
    const newSearchOpen = !searchOpen
    setSearchOpen(newSearchOpen)
    setFilterOpen(false)
    setSettingsOpen(false)
    setFolderOpen(false)
    // Axtarış paneli bağlandıqda axtarış mətnini təmizlə
    if (!newSearchOpen) {
      setSearchText('')
    }
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
      const newFolder = await categoriesAPI.create({
        name: newFolderName.trim(),
        parent_id: selectedFolder ?? undefined,
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

  const handleSaveProduct = async (isActive: boolean = false) => {
    if (!newProduct.name.trim()) {
      setToast({ message: 'Məhsul adı məcburidir', type: 'error' })
      return
    }

    try {
      // Kod və barkod dəyərlərini hazırla
      const trimmedCode = newProduct.code.trim()
      let trimmedBarcode = newProduct.barcode.trim()

      // Əgər barkod boşdursa, avtomatik unikal barkod yarat
      if (!trimmedBarcode) {
        const existingBarcodes = products
          .map(p => p.barcode)
          .filter((b): b is string => !!b)

        let newBarcode = generateBarcode()
        while (existingBarcodes.includes(newBarcode)) {
          newBarcode = generateBarcode()
        }

        trimmedBarcode = newBarcode
      }

      // Yeni məhsulda kod boşdursa və barkod kifayət qədər uzundursa, barkodun son 6 rəqəmini kod kimi istifadə et
      let finalCode = trimmedCode
      if (!finalCode && trimmedBarcode && trimmedBarcode.length >= 6) {
        finalCode = trimmedBarcode.slice(-6)
      }

      // Eyni kod / barkodla məhsul təsdiqlənməsin (unikallıq yoxlaması)
      const currentId = editingProductId

      if (finalCode) {
        const hasSameCode = products.some(
          p =>
            (currentId === null || p.id !== currentId) &&
            (p.code ? p.code.trim() : '') === finalCode,
        )
        if (hasSameCode) {
          setToast({ message: 'Bu kodla artıq məhsul var. Zəhmət olmasa fərqli kod daxil edin.', type: 'error' })
          return
        }
      }

      if (trimmedBarcode) {
        const hasSameBarcode = products.some(
          p =>
            (currentId === null || p.id !== currentId) &&
            (p.barcode ? p.barcode.trim() : '') === trimmedBarcode,
        )
        if (hasSameBarcode) {
          setToast({ message: 'Bu barkodla artıq məhsul var. Zəhmət olmasa fərqli barkod istifadə edin.', type: 'error' })
          return
        }
      }

      // Papka -> kateqoriya id
      const categoryId = newProduct.folder_id ?? selectedFolder ?? null

      // Tarixləri ISO formatına çevir
      const productionDateIso = newProduct.production_date
        ? new Date(newProduct.production_date + 'T00:00:00').toISOString()
        : undefined
      const expiryDateIso = newProduct.expiry_date
        ? new Date(newProduct.expiry_date + 'T00:00:00').toISOString()
        : undefined

      if (editingProductId !== null) {
        // Redaktə rejimi - Update
        const updatedProduct = await productsAPI.update(String(editingProductId), {
          name: newProduct.name.trim(),
          code: finalCode || undefined,
          barcode: trimmedBarcode || undefined,
          article: newProduct.article.trim() || undefined,
          description: newProduct.description.trim() || undefined,
          unit: newProduct.unit || 'ədəd',
          purchase_price: newProduct.purchase_price ? parseFloat(newProduct.purchase_price) : 0,
          sale_price: newProduct.sale_price ? parseFloat(newProduct.sale_price) : 0,
          category_id: categoryId,
          type: newProduct.type.trim() || undefined,
          brand: newProduct.brand.trim() || undefined,
          model: newProduct.model.trim() || undefined,
          color: newProduct.color.trim() || undefined,
          country: newProduct.country.trim() || undefined,
          manufacturer: newProduct.manufacturer.trim() || undefined,
          production_date: productionDateIso,
          expiry_date: expiryDateIso,
          is_active: isActive,
        })

        const extendedUpdated: ExtendedProduct = {
          ...(updatedProduct as Product),
          folder_id: updatedProduct.category_id,
        }

        // Products state-ə yenilə
        setProducts(products.map(c => c.id === editingProductId ? extendedUpdated : c))
        setToast({ message: 'Məhsul uğurla yeniləndi', type: 'success' })
      } else {
        // Yeni məhsul - Create
        const createdProduct = await productsAPI.create({
          name: newProduct.name.trim(),
          code: finalCode || undefined,
          barcode: trimmedBarcode || undefined,
          article: newProduct.article.trim() || undefined,
          description: newProduct.description.trim() || undefined,
          unit: newProduct.unit || 'ədəd',
          purchase_price: newProduct.purchase_price ? parseFloat(newProduct.purchase_price) : 0,
          sale_price: newProduct.sale_price ? parseFloat(newProduct.sale_price) : 0,
          category_id: categoryId,
          type: newProduct.type.trim() || undefined,
          brand: newProduct.brand.trim() || undefined,
          model: newProduct.model.trim() || undefined,
          color: newProduct.color.trim() || undefined,
          country: newProduct.country.trim() || undefined,
          manufacturer: newProduct.manufacturer.trim() || undefined,
          production_date: productionDateIso,
          expiry_date: expiryDateIso,
          is_active: isActive,
        } as any)

        const extendedCreated: ExtendedProduct = {
          ...(createdProduct as Product),
          folder_id: createdProduct.category_id,
        }

        // Products state-ə əlavə et
        setProducts([...products, extendedCreated])
        setToast({ 
          message: isActive 
            ? 'Məhsul uğurla yaradıldı və aktiv edildi' 
            : 'Məhsul uğurla yaradıldı (passiv)', 
          type: 'success' 
        })
      }

      // Modalı bağla və formu təmizlə
      setAddProductModalOpen(false)
      setEditingProductId(null)
      setNewProduct({
        code: '',
        name: '',
        phone: '',
        email: '',
        address: '',
        folder_id: selectedFolder,
        article: '',
        barcode: '',
        description: '',
        unit: 'ədəd',
        purchase_price: '',
        sale_price: '',
        type: '',
        brand: '',
        model: '',
        color: '',
        country: '',
        manufacturer: '',
        production_date: '',
        expiry_date: '',
      })
    } catch (error: any) {
      console.error('Məhsul saxlanarkən xəta:', error)
      setToast({ 
        message: error.response?.data?.message || (editingProductId ? 'Məhsul yenilənərkən xəta baş verdi' : 'Məhsul yaradılarkən xəta baş verdi'), 
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
      const updatedFolder = await categoriesAPI.update(String(folderId), {
        name: newName.trim(),
        parent_id: folder.parent_id ?? undefined,
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
      await categoriesAPI.delete(String(folderId))
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
      await categoriesAPI.update(String(folderToMove), {
        name: folder.name,
        parent_id: targetFolderId ?? undefined,
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
      const productIds = Array.from(selectedIds)
      await categoriesAPI.moveProducts(productIds, folderId)
      
      // Müştəriləri yenilə
      await loadProducts()
      
      // Papkaları yenilə (product_count dəyişə bilər)
      await loadFolders()
      
      // Seçimləri təmizlə
      setSelectedIds(new Set())
      
      // Köçürmə rejimini söndür
      setMoveMode(false)
      
      setToast({ 
        message: `${productIds.length} müştəri "${folderName}" papkasına köçürüldü`, 
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
              ({getProductCountForFolder(folder.id)})
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
            // const folderProducts = products.filter(c => c.folder_id === folder.id)
            // const hasProducts = folderProducts.length > 0
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
                    ({getProductCountForFolder(folder.id)})
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

    const folderProducts = products.filter(c => c.folder_id === currentFolder.id)
    const hasProducts = folderProducts.length > 0
    const hasChildren = currentFolder.children && currentFolder.children.length > 0

    // Əgər nə alt papkalar, nə də müştərilər yoxdursa
    if (!hasChildren && !hasProducts) {
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
                  ({getProductCountForFolder(folder.id)})
                </span>
              </div>
            </div>
          )
        })}

        {/* Bu papkanın müştəriləri */}
        {hasProducts && (
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
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={folderProducts.length > 0 && folderProducts.every(c => selectedIds.has(c.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newSelected = new Set(selectedIds)
                          folderProducts.forEach(c => newSelected.add(c.id))
                          setSelectedIds(newSelected)
                        } else {
                          const newSelected = new Set(selectedIds)
                          folderProducts.forEach(c => newSelected.delete(c.id))
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
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
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
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
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
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
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
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
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
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                    }}
                  >
                    Balans
                  </th>
                </tr>
              </thead>
              <tbody>
                {folderProducts.map((product) => {
                  const isSelected = selectedIds.has(product.id)
                  return (
                    <tr
                      key={product.id}
                      onClick={() => handleSelect(product.id)}
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
                          onChange={() => handleSelect(product.id)}
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
                        {product.code || '-'}
                      </td>
                      <td 
                        style={{ 
                          padding: '0.5rem',
                          borderRight: '1px solid #e0e0e0',
                          fontWeight: isSelected ? 'bold' : 'normal',
                        }}
                      >
                        {product.name}
                      </td>
                      <td 
                        style={{ 
                          padding: '0.5rem',
                          borderRight: '1px solid #e0e0e0',
                          color: '#666',
                          fontFamily: 'monospace',
                        }}
                      >
                        {product.barcode || '-'}
                      </td>
                      <td 
                        style={{ 
                          padding: '0.5rem',
                          borderRight: '1px solid #e0e0e0',
                          color: '#666',
                        }}
                      >
                        {product.unit || 'ədəd'}
                      </td>
                      <td 
                        style={{ 
                          padding: '0.5rem',
                          textAlign: 'right',
                          fontWeight: 'bold',
                        }}
                      >
                        {getQuantityForProduct(product)}
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

  // Sort funksiyası
  const handleSort = (columnKey: string) => {
    if (columnKey === 'checkbox' || columnKey === 'rowNumber') return // Checkbox və sıra sütununu sort etmə
    
    setSortConfig(prev => {
      if (prev?.key === columnKey) {
        // Eyni sütuna basıldıqda istiqaməti dəyiş
        const newDirection: 'asc' | 'desc' = prev.direction === 'asc' ? 'desc' : 'asc'
        const newConfig = { key: columnKey, direction: newDirection }
        localStorage.setItem('productTableSortConfig', JSON.stringify(newConfig))
        return newConfig
      } else {
        // Yeni sütuna basıldıqda asc ilə başla
        const newConfig: { key: string; direction: 'asc' | 'desc' } = { key: columnKey, direction: 'asc' }
        localStorage.setItem('productTableSortConfig', JSON.stringify(newConfig))
        return newConfig
      }
    })
  }

  const getQuantityForProduct = (product: ExtendedProduct): number => {
    const raw = (product as any).warehouse?.[0]?.quantity
    const num = raw !== null && raw !== undefined ? Number(raw) : 0
    return isNaN(num) ? 0 : num
  }

  const getPurchaseTotalForProduct = (product: ExtendedProduct): number => {
    const qty = getQuantityForProduct(product)
    const price = product.purchase_price !== null && product.purchase_price !== undefined ? Number(product.purchase_price) : 0
    return (isNaN(qty) ? 0 : qty) * (isNaN(price) ? 0 : price)
  }

  const getSaleTotalForProduct = (product: ExtendedProduct): number => {
    const qty = getQuantityForProduct(product)
    const price = product.sale_price !== null && product.sale_price !== undefined ? Number(product.sale_price) : 0
    return (isNaN(qty) ? 0 : qty) * (isNaN(price) ? 0 : price)
  }

  // Sıralanmış məhsullar
  const getSortedProducts = (productsList: ExtendedProduct[]) => {
    if (!sortConfig) return productsList

    const sorted = [...productsList].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortConfig.key) {
        case 'id':
          aValue = a.id
          bValue = b.id
          break
        case 'code':
          aValue = a.code || ''
          bValue = b.code || ''
          break
        case 'name':
          aValue = a.name || ''
          bValue = b.name || ''
          break
        case 'barcode':
          aValue = a.barcode || ''
          bValue = b.barcode || ''
          break
        case 'unit':
          aValue = a.unit || ''
          bValue = b.unit || ''
          break
        case 'purchase_price':
          aValue = a.purchase_price || 0
          bValue = b.purchase_price || 0
          break
        case 'sale_price':
          aValue = a.sale_price || 0
          bValue = b.sale_price || 0
          break
        case 'quantity':
          aValue = getQuantityForProduct(a)
          bValue = getQuantityForProduct(b)
          break
        case 'purchase_total':
          aValue = getPurchaseTotalForProduct(a)
          bValue = getPurchaseTotalForProduct(b)
          break
        case 'sale_total':
          aValue = getSaleTotalForProduct(a)
          bValue = getSaleTotalForProduct(b)
          break
        default:
          return 0
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      } else {
        const av = Number(aValue)
        const bv = Number(bValue)
        return sortConfig.direction === 'asc'
          ? (av > bv ? 1 : av < bv ? -1 : 0)
          : (av < bv ? 1 : av > bv ? -1 : 0)
      }
    })

    return sorted
  }

  const filteredProductsRaw = selectedFolder === null
    ? products // Bütün müştərilər
    : products.filter(product => product.folder_id === selectedFolder)
  
  // Axtarış məntiqini tətbiq et
  const filteredBySearch = searchText.trim() === ''
    ? filteredProductsRaw
    : filteredProductsRaw.filter(product => {
        const searchLower = searchText.toLowerCase().trim()
        return (
          product.name?.toLowerCase().includes(searchLower) ||
          product.code?.toLowerCase().includes(searchLower) ||
          product.barcode?.toLowerCase().includes(searchLower)
        )
      })
  
  const filteredProducts = getSortedProducts(filteredBySearch)

  // Ekran ölçüsünə görə dinamik görünən sətir sayı
  const DEFAULT_ROW_HEIGHT = isMobile ? 44 : 40
  const tableBodyMaxHeightPx = DEFAULT_ROW_HEIGHT * rowsPerPage

  // Aşağı summary üçün statistikalar
  const totalVisibleCount = filteredProducts.length
  const totalVisibleQuantity = filteredProducts.reduce((sum, c) => {
    return sum + getQuantityForProduct(c)
  }, 0)
  const totalVisiblePurchaseTotal = filteredProducts.reduce((sum, c) => {
    return sum + getPurchaseTotalForProduct(c)
  }, 0)
  const totalVisibleSaleTotal = filteredProducts.reduce((sum, c) => {
    return sum + getSaleTotalForProduct(c)
  }, 0)
  // Seçilmiş sətrlər üçün statistikalar (hazırda istifadə olunmur, gələcəkdə lazım ola bilər)

  // rowsPerPage dəyərini localStorage-a yaz
  useEffect(() => {
    localStorage.setItem('productTableRowsPerPage', String(rowsPerPage))
    setRowsPerPageInput(String(rowsPerPage))
  }, [rowsPerPage])

  // Seçilmiş papkadakı müştərilərin sayını hesabla
  const getProductCountForFolder = (folderId: number | null) => {
    if (folderId === null) {
      return products.length
    }
    return products.filter(c => c.folder_id === folderId).length
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

  // Layout sabitləri - navbar, toolbar və cədvəl arasındakı boşluqlar
  const NAVBAR_HEIGHT = 56
  const NAVBAR_TOOLBAR_GAP = 20  // Navbar ilə toolbar arasındakı boşluq
  const TOOLBAR_TABLE_GAP = 0    // Toolbar ilə cədvəl başlığı arasında əlavə boşluq olmasın

  const toolbarTop = NAVBAR_HEIGHT + NAVBAR_TOOLBAR_GAP
  const contentPaddingTop =
    toolbarTop +
    toolbarHeight +
    searchPanelHeight +
    filterPanelHeight +
    folderPanelHeight +
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
            border: debugMode ? '2px solid red' : 'none', // DEBUG
            boxSizing: 'border-box',
          }}
        >
          {debugMode && (
            <span
              style={{
                position: 'absolute',
                top: 2,
                left: 2,
                background: 'red',
                color: 'white',
                fontSize: 10,
                padding: '1px 3px',
                borderRadius: 2,
                zIndex: 1000,
                fontWeight: 'bold',
              }}
            >
              TOOLBAR
            </span>
          )}
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

        {/* Filtr paneli */}
        {filterOpen && (
          <div
            ref={filterPanelRef}
            style={{
              background: '#f5f5f5',
              padding: '0.35rem 0.75rem',
              borderBottom: '1px solid #e0e0e0',
              flexShrink: 0,
              position: 'fixed',
              top: `${toolbarTop + toolbarHeight + searchPanelHeight}px`,
              left: 0,
              right: 0,
              zIndex: 998,
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

        {/* Papka üst paneli - toolbarla cədvəl arasında, axtarış kimi */}
        {folderOpen && (
          <div
            ref={folderPanelRef}
            style={{
              background: '#f5f5f5',
              padding: '0.4rem 0.75rem',
              borderBottom: '1px solid #e0e0e0',
              flexShrink: 0,
              position: 'fixed',
              top: `${toolbarTop + toolbarHeight + searchPanelHeight + filterPanelHeight}px`,
              left: 0,
              right: 0,
              zIndex: 998,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              border: debugMode ? '2px solid purple' : 'none', // DEBUG
              boxSizing: 'border-box',
            }}
          >
            {debugMode && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: 2,
                  background: 'purple',
                  color: 'white',
                  fontSize: 10,
                  padding: '1px 3px',
                  borderRadius: 2,
                  zIndex: 1000,
                  fontWeight: 'bold',
                }}
              >
                FOLDER PANEL
              </span>
            )}
            <div style={{ fontSize: '0.85rem', color: '#333', overflowX: 'auto', whiteSpace: 'nowrap' }}>
              {folderPath.map((item, index) => (
                <span key={item.id || 'root'}>
                  {index > 0 && <span style={{ color: '#999', margin: '0 0.25rem' }}>›</span>}
                  {/* Root üçün (Bütün alıcılar) papka ağacı gizlidirsə, yalnız üçbucağa basanda aç */}
                  {index === 0 && !folderTreeVisible && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        setFolderTreeVisible(true)
                        localStorage.setItem('folderTreeVisible', 'true')
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '3px',
                        border: '1px solid #1976d2',
                        marginRight: '0.4rem',
                        cursor: 'pointer',
                        color: '#1976d2',
                        fontSize: '0.8rem',
                        background: '#e3f2fd',
                      }}
                    >
                      ▶
                    </span>
                  )}
                  <span
                    style={{
                      cursor: 'pointer',
                      color: index === folderPath.length - 1 ? '#1976d2' : '#666',
                      fontWeight: index === folderPath.length - 1 ? 'bold' : 'normal',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}
                    onClick={() => {
                      // Yalnız mətni klikləyəndə papkanı seç (ağacı açmadan)
                      setSelectedFolder(item.id)
                      setSelectedIds(new Set())
                    }}
                  >
                    {item.name}
                  </span>
                </span>
              ))}
            </div>
            {selectedFolder !== null && (
              <div style={{ fontSize: '0.8rem', color: '#666', flexShrink: 0 }}>
                {filteredProducts.length} müştəri
              </div>
            )}
          </div>
        )}


        {/* Cədvəl və Papka Paneli */}
        <div 
          style={{
            display: 'flex', 
            flex: 1, 
            overflow: 'hidden', 
            flexDirection: folderViewMode === 'accordion' ? 'column' : 'row',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
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
                zIndex: 1001,
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
                  position: 'sticky',
                  top: 0,
                  zIndex: 1001,
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
                    ({getProductCountForFolder(null)})
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
                position: 'relative',
                zIndex: 1001,
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
                  position: 'sticky',
                  top: 0,
                  zIndex: 1001,
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
                      // const folderProducts = products.filter(c => c.folder_id === folder.id)
                      // const hasProducts = folderProducts.length > 0
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
                              ({getProductCountForFolder(folder.id)})
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    
                    {/* Bütün müştərilər */}
                    {products.length > 0 && (
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
                                  userSelect: 'none',
                                  WebkitUserSelect: 'none',
                                  MozUserSelect: 'none',
                                  msUserSelect: 'none',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={products.length > 0 && products.every(c => selectedIds.has(c.id))}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      const newSelected = new Set(selectedIds)
                                      products.forEach(c => newSelected.add(c.id))
                                      setSelectedIds(newSelected)
                                    } else {
                                      const newSelected = new Set(selectedIds)
                                      products.forEach(c => newSelected.delete(c.id))
                                      setSelectedIds(newSelected)
                                    }
                                  }}
                                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                              </th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd', borderRight: '1px solid #e0e0e0', fontWeight: 'bold', fontSize: '0.8rem', color: '#333', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>Kod</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd', borderRight: '1px solid #e0e0e0', fontWeight: 'bold', fontSize: '0.8rem', color: '#333', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>Ad</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd', borderRight: '1px solid #e0e0e0', fontWeight: 'bold', fontSize: '0.8rem', color: '#333', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>Telefon</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #ddd', borderRight: '1px solid #e0e0e0', fontWeight: 'bold', fontSize: '0.8rem', color: '#333', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>Papka</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right', borderBottom: '2px solid #ddd', fontWeight: 'bold', fontSize: '0.8rem', color: '#333', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>Balans</th>
                            </tr>
                          </thead>
                          <tbody>
                            {products.map((product) => {
                              const isSelected = selectedIds.has(product.id)
                              const qty = getQuantityForProduct(product)
                              const saleTotal = getSaleTotalForProduct(product)
                              return (
                                <tr
                                  key={product.id}
                                  onClick={() => handleSelect(product.id)}
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
                                      onChange={() => handleSelect(product.id)}
                                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
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
                                    {product.code || '-'}
                                  </td>
                                  <td
                                    style={{
                                      padding: '0.5rem',
                                      borderRight: '1px solid #e0e0e0',
                                      fontWeight: isSelected ? 'bold' : 'normal',
                                    }}
                                  >
                                    {product.name}
                                  </td>
                                  <td
                                    style={{
                                      padding: '0.5rem',
                                      borderRight: '1px solid #e0e0e0',
                                      color: '#666',
                                      fontFamily: 'monospace',
                                    }}
                                  >
                                    {product.barcode || '-'}
                                  </td>
                                  <td
                                    style={{
                                      padding: '0.5rem',
                                      borderRight: '1px solid #e0e0e0',
                                      color: '#666',
                                    }}
                                  >
                                    {product.unit || 'ədəd'}
                                  </td>
                                  <td
                                    style={{
                                      padding: '0.5rem',
                                      borderRight: '1px solid #e0e0e0',
                                      textAlign: 'right',
                                    }}
                                  >
                                    {qty}
                                  </td>
                                  <td
                                    style={{
                                      padding: '0.5rem',
                                      textAlign: 'right',
                                      fontWeight: 'bold',
                                      color: saleTotal < 0 ? '#d32f2f' : '#2e7d32',
                                    }}
                                  >
                                    {saleTotal.toFixed(2)} ₼
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
            style={{
              flex: 1,
              overflow: 'hidden',
              background: 'white',
              minWidth: 0,
              maxWidth: '100%',
              width: '100%',
              margin: 0,
              padding: 0,
              boxSizing: 'border-box',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Yüklənmə vəziyyəti */}
            {loading && (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Yüklənir...</div>
            )}

            {/* Cədvəl konteyneri – burada scroll YOXDUR, yalnız daxili tableBodyScrollRef scroll olur */}
            {!loading && (
              <div
                style={{
                  overflow: 'hidden', // vertikal scroll bu konteynerdə deyil
                  flex: 1,
                  padding: 0,
                  margin: 0,
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  paddingBottom: isMobile ? 8 : 8, // Alt hissədə minimal boşluq
                }}
              >
                {/* Boş mesaj */}
                {filteredProducts.length === 0 && (
                  <div
                    style={{
                      padding: '2rem',
                      textAlign: 'center',
                      color: '#666',
                      background: 'white',
                    }}
                  >
                    {selectedFolder === null ? 'Alıcı tapılmadı' : `Bu papkada alıcı yoxdur`}
                  </div>
                )}

                {/* Cədvəl yalnız məhsul olanda göstərilsin */}
                {filteredProducts.length > 0 && (
                  <div
                    style={{
                      position: 'relative',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 0,
                      overflow: 'hidden',
                    }}
                  >
                    {debugMode && (
                      <div
                        className="debug-label-purple"
                        style={{
                          position: 'absolute',
                          top: '2px',
                          left: '2px',
                          background: 'purple',
                          color: 'white',
                          padding: '2px 4px',
                          fontSize: '10px',
                          zIndex: 10000,
                          fontWeight: 'bold',
                        }}
                      >
                        PURPLE
                      </div>
                    )}
                    <div
                      ref={tableBodyScrollRef}
                      style={{
                        minHeight: 0,
                        overflowX: 'auto',
                        // Yalnız cədvəl gövdəsi yuxarı-aşağı scroll olsun, sabit çərçivə hündürlüyü ilə
                        overflowY: 'auto',
                        maxHeight: `${tableBodyMaxHeightPx}px`,
                        flex: 1,
                        WebkitOverflowScrolling: 'touch',
                        // Daxili scroll bitəndə hərəkət yuxarı parent-lərə keçməsin (mobil rezin effektini azaldır)
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
                    margin: 0,
                    padding: 0,
                    border: debugMode ? '3px solid purple' : 'none',
                    boxSizing: 'border-box',
                    display: 'table',
                  }}
                >
                  <colgroup>
                    {columnOrder.map((columnKey) => {
                      const config = columnConfig[columnKey]
                      if (!config || !columnVisibility[columnKey]) return null
                      const isCheckbox = columnKey === 'checkbox'
                      const width = columnWidths[columnKey] || (isCheckbox ? 50 : 100)
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
                            onDragEnter={(e) => handleDragEnter(e, columnKey)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, columnKey)}
                            onDragEnd={handleDragEnd}
                            onClick={() => !isCheckbox && !isDragging && handleSort(columnKey)}
                            style={{
                              padding: isCheckbox
                                ? folderTreeVisible
                                  ? '0.75rem 0.5rem'
                                  : '0.75rem 0.25rem'
                                : '0.75rem',
                              paddingLeft: isCheckbox
                                ? folderTreeVisible
                                  ? '0.5rem'
                                  : '0.25rem'
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
                              overflow: isCheckbox ? 'visible' : 'hidden',
                              textOverflow: isCheckbox ? 'clip' : 'ellipsis',
                              cursor: isCheckbox ? 'default' : 'pointer',
                              userSelect: 'none',
                              WebkitUserSelect: 'none',
                              MozUserSelect: 'none',
                              msUserSelect: 'none',
                              background: '#f5f5f5',
                              position: 'sticky',
                              top: 0,
                              zIndex: isCheckbox ? 11 : 10,
                            }}
                          >
                            {isCheckbox ? (
                              <input
                                type="checkbox"
                                checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                                onChange={() => {
                                  if (selectedIds.size === filteredProducts.length) {
                                    const newSelected = new Set(selectedIds)
                                    filteredProducts.forEach(c => newSelected.delete(c.id))
                                    setSelectedIds(newSelected)
                                  } else {
                                    const newSelected = new Set(selectedIds)
                                    filteredProducts.forEach(c => newSelected.add(c.id))
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
                    {filteredProducts.map((product) => {
                      const isSelected = selectedIds.has(product.id)
                      return (
                        <tr
                          key={product.id}
                          onClick={(e) => handleSelect(product.id, e)}
                          style={{
                            background: isSelected ? '#e3f2fd' : 'white',
                            cursor: 'pointer',
                            borderBottom: '1px solid #eee',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={
                            isMobile
                              ? undefined
                              : (e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.background = '#f5f5f5'
                                    // Checkbox sütununun background rəngini də yenilə
                                    const checkboxCell = e.currentTarget.querySelector(
                                      'td[data-column-key="checkbox"]',
                                    ) as HTMLElement
                                    if (checkboxCell) {
                                      checkboxCell.style.background = '#f5f5f5'
                                    }
                                  }
                                }
                          }
                          onMouseLeave={
                            isMobile
                              ? undefined
                              : (e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.background = 'white'
                                    // Checkbox sütununun background rəngini də yenilə
                                    const checkboxCell = e.currentTarget.querySelector(
                                      'td[data-column-key="checkbox"]',
                                    ) as HTMLElement
                                    if (checkboxCell) {
                                      checkboxCell.style.background = 'white'
                                    }
                                  }
                                }
                          }
                        >
                          {columnOrder.map((columnKey) => {
                            const config = columnConfig[columnKey]
                            if (!config) return null
                            
                            // Sütun görünürlüyünü yoxla
                            if (!columnVisibility[columnKey]) return null

                            const isCheckbox = columnKey === 'checkbox'
                            const isRowNumber = columnKey === 'rowNumber'
                            const width = columnWidths[columnKey] || (isCheckbox || isRowNumber ? 70 : 100)

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
                              overflow: isCheckbox ? 'visible' : 'hidden',
                              textOverflow: isCheckbox ? 'clip' : 'ellipsis',
                              whiteSpace: isCheckbox ? 'normal' : 'nowrap',
                              position: isCheckbox ? 'sticky' : 'relative',
                              left: isCheckbox ? 0 : 'auto',
                              zIndex: isCheckbox ? 5 : 'auto',
                              background: isCheckbox ? '#f5f5f5' : 'transparent',
                            }

                            if (isCheckbox) {
                              // Checkbox sütunu üçün background rəngini seçilmiş sətirə görə təyin et
                              cellStyle.background = isSelected ? '#e3f2fd' : '#f5f5f5'
                              cellContent = (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    // Normal klik üçün (Ctrl basılmadıqda)
                                    handleSelect(product.id)
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    // Ctrl+Click üçün checkbox-da da işləsin
                                    if (e.ctrlKey || e.metaKey) {
                                      e.preventDefault() // onChange-in trigger olmasının qarşısını al
                                      handleSelect(product.id, e)
                                    }
                                  }}
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    cursor: 'pointer',
                                  }}
                                />
                              )
                            } else if (isRowNumber) {
                              cellContent = filteredProducts.indexOf(product) + 1
                            } else if (columnKey === 'id') {
                              // Cədvəldə ID-ni Malın ID-si formatında göstər (M00000001 və s.)
                              cellStyle.color = '#666'
                              cellStyle.fontFamily = 'monospace'
                              cellContent = product.id != null ? `M${product.id.toString().padStart(8, '0')}` : '-'
                            } else if (columnKey === 'code') {
                              cellStyle.color = '#666'
                              cellStyle.fontFamily = 'monospace'
                              cellContent = product.code || '-'
                            } else if (columnKey === 'name') {
                              cellStyle.fontWeight = isSelected ? 'bold' : 'normal'
                              cellContent = product.name
                            } else if (columnKey === 'barcode') {
                              cellStyle.color = '#666'
                              cellStyle.fontFamily = 'monospace'
                              cellContent = product.barcode || '-'
                            } else if (columnKey === 'unit') {
                              cellStyle.color = '#666'
                              cellContent = product.unit || 'ədəd'
                            } else if (columnKey === 'purchase_price') {
                              const value =
                                product.purchase_price !== null && product.purchase_price !== undefined
                                  ? Number(product.purchase_price)
                                  : 0
                              cellStyle.textAlign = 'right'
                              cellContent = `${isNaN(value) ? '0.00' : value.toFixed(2)} ₼`
                            } else if (columnKey === 'sale_price') {
                              const value =
                                product.sale_price !== null && product.sale_price !== undefined
                                  ? Number(product.sale_price)
                                  : 0
                              cellStyle.textAlign = 'right'
                              cellContent = `${isNaN(value) ? '0.00' : value.toFixed(2)} ₼`
                            } else if (columnKey === 'quantity') {
                              const qty = getQuantityForProduct(product)
                              cellStyle.textAlign = 'right'
                              cellContent = qty
                            } else if (columnKey === 'purchase_total') {
                              const total = getPurchaseTotalForProduct(product)
                              cellStyle.textAlign = 'right'
                              cellContent = `${total.toFixed(2)} ₼`
                            } else if (columnKey === 'sale_total') {
                              const total = getSaleTotalForProduct(product)
                              cellStyle.textAlign = 'right'
                              cellStyle.fontWeight = 'bold'
                              cellContent = `${total.toFixed(2)} ₼`
                            }

                            return (
                              <td
                                key={columnKey}
                                data-column-key={columnKey}
                                style={cellStyle}
                              >
                                {cellContent}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                  {/* Cədvəl alt cəmi üçün footer sətri – eyni cədvəl daxilində, sütunlara yapışıq */}
                  <tfoot>
                    <tr>
                      {columnOrder.map((columnKey) => {
                        if (!columnVisibility[columnKey]) return null
                        const config = columnConfig[columnKey]
                        const width = columnWidths[columnKey] || 80

                        const cellStyle: React.CSSProperties = {
                          padding: '0.5rem',
                          borderTop: '1px solid #e0e0e0',
                          borderRight: columnKey !== 'sale_total' ? '1px solid #e0e0e0' : 'none',
                          textAlign: config?.align || 'left',
                          minWidth: width,
                          maxWidth: width,
                          fontSize: '0.85rem',
                          background: '#f5f5f5',
                          fontWeight:
                            columnKey === 'quantity' || columnKey === 'purchase_total' || columnKey === 'sale_total'
                              ? 'bold'
                              : 500,
                          color:
                            columnKey === 'quantity'
                              ? '#ff9800'
                              : columnKey === 'purchase_total'
                              ? '#4caf50'
                              : columnKey === 'sale_total'
                              ? '#1976d2'
                              : '#555',
                          position: 'sticky',
                          bottom: 0,
                          zIndex: 8,
                        }

                        let content: React.ReactNode = ''

                        if (columnKey === 'name') {
                          content = `Cəmi (${totalVisibleCount} sətir)`
                          cellStyle.textAlign = 'left'
                          cellStyle.fontWeight = 600
                          cellStyle.color = '#333'
                        } else if (columnKey === 'quantity') {
                          cellStyle.textAlign = 'right'
                          content = totalVisibleQuantity.toFixed(2)
                        } else if (columnKey === 'purchase_total') {
                          cellStyle.textAlign = 'right'
                          content = `${totalVisiblePurchaseTotal.toFixed(2)} ₼`
                        } else if (columnKey === 'sale_total') {
                          cellStyle.textAlign = 'right'
                          content = `${totalVisibleSaleTotal.toFixed(2)} ₼`
                        } else {
                          content = ''
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
              </div>
              )}
            </div>
          )}
        </div>
          )}

        {/* Cədvəl və Papka Paneli konteynerinin bağlanması */}
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
      {addProductModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setAddProductModalOpen(false)
              setEditingProductId(null)
              setNewProduct({
                code: '',
                name: '',
                phone: '',
                email: '',
                address: '',
                folder_id: selectedFolder,
                article: '',
                barcode: '',
                description: '',
                unit: 'ədəd',
                purchase_price: '',
                sale_price: '',
                type: '',
                brand: '',
                model: '',
                color: '',
                country: '',
                manufacturer: '',
                production_date: '',
                expiry_date: '',
              })
            }
          }}
          style={{
            position: 'fixed',
            top: isMobile ? '56px' : 0, // Mobil üçün top navbar hündürlüyü
            left: 0,
            right: 0,
            bottom: 0, // Tam ekran – altda cədvəl / footer görünməsin
            background: 'rgba(0, 0, 0, 0.35)',
            // Altdakı səhifəni bulanıq göstərmək üçün
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
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
              {editingProductId !== null ? 'Məhsulu redaktə et' : 'Yeni məhsul əlavə et'}
            </h2>

            {/* Tablar: Əsas / Malın IDS-i */}
            <div
              style={{
                display: 'flex',
                marginBottom: '1rem',
                borderBottom: '1px solid #eee',
              }}
            >
              <button
                type="button"
                onClick={() => setProductModalTab('basic')}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  border: 'none',
                  borderBottom: productModalTab === 'basic' ? '3px solid #1976d2' : '3px solid transparent',
                  background: 'transparent',
                  color: productModalTab === 'basic' ? '#1976d2' : '#555',
                  fontWeight: productModalTab === 'basic' ? 600 : 500,
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                }}
              >
                Əsas məlumatlar
              </button>
              <button
                type="button"
                onClick={() => setProductModalTab('details')}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  border: 'none',
                  borderBottom: productModalTab === 'details' ? '3px solid #1976d2' : '3px solid transparent',
                  background: 'transparent',
                  color: productModalTab === 'details' ? '#1976d2' : '#555',
                  fontWeight: productModalTab === 'details' ? 600 : 500,
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                }}
              >
                Malın IDS-i
              </button>
            </div>

            {productModalTab === 'basic' && (
              <>
                {/* Məhsul adı */}
                <div style={{ marginBottom: '1rem' }}>
                  <input
                    type="text"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="Məhsul adı *"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        handleSaveProduct()
                      } else if (e.key === 'Escape') {
                        setAddProductModalOpen(false)
                        setEditingProductId(null)
                        setNewProduct({
                          code: '',
                          name: '',
                          phone: '',
                          email: '',
                          address: '',
                          folder_id: selectedFolder,
                          article: '',
                          barcode: '',
                          description: '',
                          unit: 'ədəd',
                          purchase_price: '',
                          sale_price: '',
                          type: '',
                          brand: '',
                          model: '',
                          color: '',
                          country: '',
                          manufacturer: '',
                          production_date: '',
                          expiry_date: '',
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

                {/* Kod və artikul yan-yana */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div>
                    <input
                      type="text"
                      value={newProduct.code}
                      onChange={(e) => setNewProduct({ ...newProduct, code: e.target.value })}
                      placeholder="Kod (avtomatik ola bilər)"
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
                  <div>
                    <input
                      type="text"
                      value={newProduct.article}
                      onChange={(e) => setNewProduct({ ...newProduct, article: e.target.value })}
                      placeholder="Artikul"
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
                </div>

                {/* Barkod və oxuma düymələri */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={newProduct.barcode}
                      onChange={(e) => handleBarcodeChange(e.target.value)}
                      placeholder="Barkod"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        fontSize: '1rem',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        minHeight: '44px',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleBarcodeScanFromCamera}
                      style={{
                        padding: '0.75rem',
                        background: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        minHeight: '44px',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      📷
                    </button>
                    <button
                      type="button"
                      onClick={handleBarcodeOptionsClick}
                      style={{
                        padding: '0.75rem',
                        background: '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        minHeight: '44px',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      |||
                    </button>
                  </div>

                  {barcodeOptionsOpen && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        display: 'flex',
                        gap: '0.5rem',
                      }}
                    >
                      <button
                        type="button"
                        onClick={handleBarcodeOptionGallery}
                        style={{
                          flex: 1,
                          padding: '0.6rem 0.75rem',
                          background: '#4caf50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.95rem',
                        }}
                      >
                        Qalereyadan oxut
                      </button>
                      <button
                        type="button"
                        onClick={handleBarcodeOptionAuto}
                        style={{
                          flex: 1,
                          padding: '0.6rem 0.75rem',
                          background: '#2196f3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.95rem',
                        }}
                      >
                        Avto barkod
                      </button>
                    </div>
                  )}
                </div>

                {/* Təsvir */}
                <div style={{ marginBottom: '1rem' }}>
                  <textarea
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    placeholder="Məhsul təsviri"
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

                {/* Vahid və qiymətlər */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div>
                    <select
                      value={newProduct.unit}
                      onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        fontSize: '1rem',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        minHeight: '44px',
                        boxSizing: 'border-box',
                        background: 'white',
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
                    <input
                      type="number"
                      value={newProduct.purchase_price}
                      onChange={(e) => setNewProduct({ ...newProduct, purchase_price: e.target.value })}
                      placeholder="Alış qiyməti"
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
                  <div>
                    <input
                      type="number"
                      value={newProduct.sale_price}
                      onChange={(e) => setNewProduct({ ...newProduct, sale_price: e.target.value })}
                      placeholder="Satış qiyməti"
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
                </div>
              </>
            )}

            {productModalTab === 'details' && (
              <>
                {/* Malın IDS-i və əlavə məlumatlar */}
                <div style={{ marginBottom: '1rem' }}>
                  <input
                    type="text"
                    value={
                      editingProductId !== null
                        ? `M${editingProductId.toString().padStart(8, '0')}`
                        : ''
                    }
                    readOnly
                    placeholder="Malın ID-si (M00000001 ...) yadda saxlayanda avtomatik veriləcək"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '1rem',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      minHeight: '44px',
                      boxSizing: 'border-box',
                      background: '#f9f9f9',
                      color: '#555',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div>
                    <input
                      type="text"
                      value={newProduct.type}
                      onChange={(e) => setNewProduct({ ...newProduct, type: e.target.value })}
                      placeholder="Növ/Tip"
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
                  <div>
                    <input
                      type="text"
                      value={newProduct.brand}
                      onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                      placeholder="Marka"
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
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div>
                    <input
                      type="text"
                      value={newProduct.model}
                      onChange={(e) => setNewProduct({ ...newProduct, model: e.target.value })}
                      placeholder="Model"
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
                  <div>
                    <input
                      type="text"
                      value={newProduct.color}
                      onChange={(e) => setNewProduct({ ...newProduct, color: e.target.value })}
                      placeholder="Rəng"
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
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <input
                    type="text"
                    value={newProduct.country}
                    onChange={(e) => setNewProduct({ ...newProduct, country: e.target.value })}
                    placeholder="Ölkə"
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

                <div style={{ marginBottom: '0.75rem' }}>
                  <input
                    type="text"
                    value={newProduct.manufacturer}
                    onChange={(e) => setNewProduct({ ...newProduct, manufacturer: e.target.value })}
                    placeholder="İstehsalçı"
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

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div>
                    <input
                      type="date"
                      value={newProduct.production_date}
                      onChange={(e) => setNewProduct({ ...newProduct, production_date: e.target.value })}
                      placeholder="İstehsal tarixi"
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
                  <div>
                    <input
                      type="date"
                      value={newProduct.expiry_date}
                      onChange={(e) => setNewProduct({ ...newProduct, expiry_date: e.target.value })}
                      placeholder="Bitmə tarixi"
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
                </div>
              </>
            )}

            <div
              style={{
                marginBottom: barcodeScannerVisible ? '1rem' : 0,
                display: barcodeScannerVisible ? 'block' : 'none',
              }}
            >
              <div
                id="mobile-barcode-reader"
                style={{
                  width: '100%',
                  minHeight: '260px',
                  background: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}
              />
              <button
                type="button"
                onClick={stopBarcodeScanner}
                style={{
                  marginTop: '0.5rem',
                  width: '100%',
                  padding: '0.6rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                }}
              >
                Kameranı bağla
              </button>
            </div>

            {/* Papka (kateqoriya) seçimi – yalnız Əsas məlumatlar tabında göstər */}
            {productModalTab === 'basic' && (
              <div style={{ marginBottom: '1rem' }}>
                <select
                  value={newProduct.folder_id || ''}
                  onChange={(e) =>
                    setNewProduct({
                      ...newProduct,
                      folder_id: e.target.value ? parseInt(e.target.value) : null,
                    })
                  }
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
                    color: newProduct.folder_id ? 'inherit' : '#999',
                  }}
                >
                  <option value="" style={{ color: '#999' }}>
                    Papka (kateqoriya)
                  </option>
                  {(() => {
                    const folderTree = buildFolderTree(folders)
                    const renderFolderOptions = (folderList: Folder[], level: number = 0): React.ReactNode[] => {
                      const options: React.ReactNode[] = []
                      folderList.forEach(folder => {
                        const indent = '  '.repeat(level)
                        options.push(
                          <option key={folder.id} value={folder.id}>
                            {indent}
                            {folder.name}
                          </option>,
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
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', marginTop: '1.5rem', flexWrap: 'nowrap' }}>
              <button
                onClick={() => {
                  setAddProductModalOpen(false)
                  setEditingProductId(null)
                  setNewProduct({
                    code: '',
                    name: '',
                    phone: '',
                    email: '',
                    address: '',
                    folder_id: selectedFolder,
                    article: '',
                    barcode: '',
                    description: '',
                    unit: 'ədəd',
                    purchase_price: '',
                    sale_price: '',
                    type: '',
                    brand: '',
                    model: '',
                    color: '',
                    country: '',
                    manufacturer: '',
                    production_date: '',
                    expiry_date: '',
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
              {editingProductId === null && (
                <>
                  <button
                    onClick={() => handleSaveProduct(false)}
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
                    onClick={() => handleSaveProduct(true)}
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
              {editingProductId !== null && (
                <button
                  onClick={() => handleSaveProduct(true)}
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

      {/* Şəkildən barkod oxu üçün crop modalı */}
      <BarcodeImageCropper
        open={imageCropOpen}
        file={imageCropFile}
        onClose={() => setImageCropOpen(false)}
        onDetected={(code) => {
          setNewProduct((prev) => ({ ...prev, barcode: code }))
        }}
      />

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
            bottom: 0, // Tam ekrana qədər uzansın ki, altdakı cədvəl görünməsin
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
                          <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', fontSize: '0.875rem', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>Sütun</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', fontSize: '0.875rem', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>Göstər</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', fontSize: '0.875rem', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>Genişlik</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', fontSize: '0.875rem', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>Yer</th>
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
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    gap: '0.25rem',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <button
                                    onClick={() => handleMoveColumn(columnKey, 'up')}
                                    disabled={isFirst}
                                    style={{
                                      background: isFirst ? '#f5f5f5' : '#1976d2',
                                      color: isFirst ? '#ccc' : 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      width: '24px',
                                      height: '24px',
                                      cursor: isFirst ? 'not-allowed' : 'pointer',
                                      fontSize: '0.7rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      opacity: isFirst ? 0.5 : 1,
                                      padding: 0,
                                    }}
                                  >
                                    ↑
                                  </button>
                                  <button
                                    onClick={() => handleMoveColumn(columnKey, 'down')}
                                    disabled={isLast}
                                    style={{
                                      background: isLast ? '#f5f5f5' : '#1976d2',
                                      color: isLast ? '#ccc' : 'white',
                                      border: 'none',
                                      borderRadius: '4px',
                                      width: '24px',
                                      height: '24px',
                                      cursor: isLast ? 'not-allowed' : 'pointer',
                                      fontSize: '0.7rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      opacity: isLast ? 0.5 : 1,
                                      padding: 0,
                                    }}
                                  >
                                    ↓
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
                    Navbar görünürlüyü
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                    <label 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        fontSize: '0.875rem', 
                        cursor: 'pointer',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        border: '2px solid #e0e0e0',
                        background: 'white',
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={topNavbarVisible}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setTopNavbarVisible(checked)
                          localStorage.setItem('topNavbarVisible', String(checked))
                          // Layout komponentindən import edilmiş funksiyaları çağır
                          if (typeof window !== 'undefined' && (window as any).setTopNavbarVisible) {
                            (window as any).setTopNavbarVisible(checked)
                          }
                          // Custom event göndər
                          window.dispatchEvent(new Event('navbarVisibilityChange'))
                        }}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Yuxarı navbar</div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>Yuxarıdakı navbarı göstər və ya gizlət</div>
                      </div>
                    </label>
                    <label 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        fontSize: '0.875rem', 
                        cursor: 'pointer',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        border: '2px solid #e0e0e0',
                        background: 'white',
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={bottomNavbarVisible}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setBottomNavbarVisible(checked)
                          localStorage.setItem('bottomNavbarVisible', String(checked))
                          // Layout komponentindən import edilmiş funksiyaları çağır
                          if (typeof window !== 'undefined' && (window as any).setBottomNavbarVisible) {
                            (window as any).setBottomNavbarVisible(checked)
                          }
                          // Custom event göndər
                          window.dispatchEvent(new Event('navbarVisibilityChange'))
                        }}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>Aşağı navbar</div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>Aşağıdakı navbarı göstər və ya gizlət</div>
                      </div>
                    </label>
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

                  <h3 style={{ fontSize: '1rem', fontWeight: 'bold', margin: '1.5rem 0 0.75rem' }}>
                    Cədvəldə görünən sətir sayı
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      border: '2px solid #e0e0e0',
                      background: 'white',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                        Görünən sətir sayı
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>
                        Telefon ekranına uyğun neçə sətir görmək istəyirsənsə, bu dəyəri dəyiş.
                        Minimum 5, maksimum 50 sətir.
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <input
                        type="number"
                        value={rowsPerPageInput}
                        min={5}
                        max={50}
                        onChange={(e) => {
                          // İstifadəçi sərbəst yazsın deyə əvvəlcə sadəcə string-i saxlayırıq
                          setRowsPerPageInput(e.target.value)
                        }}
                        onBlur={() => {
                          const raw = parseInt(rowsPerPageInput || '0', 10)
                          if (!Number.isFinite(raw)) {
                            setRowsPerPage(10)
                            return
                          }
                          const clamped = Math.min(Math.max(raw, 5), 50)
                          setRowsPerPage(clamped)
                        }}
                        style={{
                          width: '64px',
                          padding: '0.35rem 0.5rem',
                          border: '1px solid #e0e0e0',
                          borderRadius: '4px',
                          fontSize: '0.9rem',
                          textAlign: 'center',
                        }}
                      />
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>sətir</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '0.85rem 1.5rem',
                borderTop: '1px solid #e0e0e0',
                display: 'flex',
                justifyContent: 'flex-end',
                background: '#f7f7f9', // Kontentdən bir az fərqli fon – pəncərənin alt hissəsi kimi hiss olunsun
                boxShadow: '0 -2px 4px rgba(0,0,0,0.04)', // Yuxarıya yüngül kölgə
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
              top: `${contextMenu?.y || 0}px`,
              left: `${contextMenu?.x || 0}px`,
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
                if (contextMenu && contextMenu.folderId !== null) {
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
          message={toast?.message || ''}
          type={toast?.type || 'info'}
          onClose={() => setToast(null)}
        />
      )}
      </div>
    </Layout>
  )
}
