import React, { useState, useEffect, useCallback, useRef } from 'react'

export interface ColumnConfig {
  id: string
  label: string
  visible: boolean
  width: number
  order: number
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  render?: (value: any, row: any) => React.ReactNode
}

export interface DataTableProps<T = any> {
  // Səhifə identifikatoru (localStorage üçün)
  pageId: string
  // Sütun konfiqurasiyası
  columns: ColumnConfig[]
  // Məlumatlar
  data: T[]
  // Loading vəziyyəti
  loading?: boolean
  // Xəta mesajı
  error?: string
  // Səhifə başlığı
  title: string
  // Row ID funksiyası
  getRowId: (row: T) => number | string
  // Toolbar funksiyaları
  toolbarActions?: {
    onSettings?: () => void
    onEdit?: (selectedIds: (number | string)[]) => void
    onDelete?: (selectedIds: (number | string)[]) => void
    onCopy?: (selectedIds: (number | string)[]) => void
    onSearch?: () => void
    onFilter?: () => void
    onPrint?: () => void
    customActions?: React.ReactNode[]
  }
  // Əlavə toolbar elementləri (sol tərəf)
  leftToolbarItems?: React.ReactNode[]
  // Əlavə toolbar elementləri (sağ tərəf)
  rightToolbarItems?: React.ReactNode[]
  // Row seçimi funksiyaları
  onRowSelect?: (ids: (number | string)[]) => void
  // Row klik funksiyası
  onRowClick?: (row: T, id: number | string) => void
  // Context menu funksiyaları
  contextMenuActions?: {
    onSettings?: () => void
    onEdit?: (selectedIds: (number | string)[]) => void
    onDelete?: (selectedIds: (number | string)[]) => void
    onCopy?: (selectedIds: (number | string)[]) => void
    onActivate?: (selectedIds: (number | string)[]) => void
    onDeactivate?: (selectedIds: (number | string)[]) => void
    onSearch?: () => void
    onFilter?: () => void
    onPrint?: () => void
    customItems?: Array<{
      label: string
      icon?: string
      onClick: () => void
      disabled?: boolean
    }>
  }
  // Axtarış funksiyası
  onSearch?: (term: string) => void
  // Filtr funksiyası
  onFilter?: (filter: string) => void
  // Default sütunlar
  defaultColumns: ColumnConfig[]
  // Aktiv sütun axtarışı (sütun üzərində axtarış)
  activeSearchColumn?: string | null
  onActiveSearchColumnChange?: (columnId: string | null) => void
  // Sütun header-ına klikləyəndə çağırılır
  onColumnHeaderClick?: (columnId: string) => void
}

export default function DataTable<T = any>({
  pageId,
  columns: initialColumns,
  data,
  loading = false,
  error = '',
  title,
  getRowId,
  toolbarActions,
  leftToolbarItems = [],
  rightToolbarItems = [],
  onRowSelect,
  onRowClick,
  contextMenuActions,
  onSearch,
  onFilter,
  defaultColumns,
  activeSearchColumn,
  onActiveSearchColumnChange,
  onColumnHeaderClick
}: DataTableProps<T>) {
  // localStorage-dan columns yüklə
  const loadColumnsFromStorage = useCallback((): ColumnConfig[] => {
    try {
      const saved = localStorage.getItem(`${pageId}-columns-config`)
      if (saved) {
        const savedColumns: ColumnConfig[] = JSON.parse(saved)
        // Yeni sütunları (defaultColumns-də olan, amma savedColumns-də olmayan) əlavə et
        const savedColumnIds = new Set(savedColumns.map(col => col.id))
        const newColumns = defaultColumns.filter(col => !savedColumnIds.has(col.id))
        
        // Köhnə sütunları sil (defaultColumns-də olmayan sütunları çıxar)
        const defaultColumnIds = new Set(defaultColumns.map(col => col.id))
        const filteredSavedColumns = savedColumns.filter(col => defaultColumnIds.has(col.id))
        
        // Birləşdir: filteredSavedColumns + yeni sütunlar, order-ə görə sırala
        const mergedColumns = [...filteredSavedColumns, ...newColumns].sort((a, b) => a.order - b.order)
        
        // Köhnə sütunları yenilə (defaultColumns-dəki məlumatlarla)
        const defaultColumnMap = new Map(defaultColumns.map(col => [col.id, col]))
        const updatedColumns = mergedColumns.map(col => {
          const defaultCol = defaultColumnMap.get(col.id)
          if (defaultCol) {
            // Yeni field-ləri (məsələn render funksiyası) əlavə et
            // render funksiyası JSON-a serialize olunmur, ona görə də həmişə defaultCol-dan götürürük
            const { render, ...defaultColWithoutRender } = defaultCol
            return { 
              ...col, 
              ...defaultColWithoutRender, 
              visible: col.visible !== undefined ? col.visible : defaultCol.visible,
              ...(defaultCol.render && { render: defaultCol.render }) // render funksiyasını yalnız varsa əlavə et
            }
          }
          return col
        })
        
        return updatedColumns
      }
    } catch (e) {
      console.error('Columns config yüklənərkən xəta:', e)
    }
    return defaultColumns
  }, [pageId, defaultColumns])

  // localStorage-a columns saxla
  const saveColumnsToStorage = useCallback((cols: ColumnConfig[]) => {
    try {
      localStorage.setItem(`${pageId}-columns-config`, JSON.stringify(cols))
    } catch (e) {
      console.error('Columns config saxlanarkən xəta:', e)
    }
  }, [pageId])

  // localStorage-dan funksiyalar ayarlarını yüklə
  const loadFunctionSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem(`${pageId}-function-settings`)
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
  }, [pageId])

  const [columns, setColumns] = useState<ColumnConfig[]>(loadColumnsFromStorage)
  const [selectedRows, setSelectedRows] = useState<(number | string)[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ column: string | null; direction: 'asc' | 'desc' }>({
    column: null,
    direction: 'asc'
  })
  const [settingsTab, setSettingsTab] = useState<'columns' | 'functions'>('columns')
  const [functionSettings, setFunctionSettings] = useState(loadFunctionSettings())
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  
  // Cədvəl div-inə ref
  const tableRef = useRef<HTMLDivElement>(null)
  
  // Debug: activeSearchColumn dəyişdikdə log yaz
  React.useEffect(() => {
    console.log('[DataTable] activeSearchColumn dəyişdi:', activeSearchColumn, 'columns:', columns.map(c => c.id))
  }, [activeSearchColumn, columns])
  
  // Kontekst menyu state-ləri
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
  }>({
    visible: false,
    x: 0,
    y: 0
  })

  // Columns dəyişdikdə localStorage-a saxla
  useEffect(() => {
    saveColumnsToStorage(columns)
  }, [columns, saveColumnsToStorage])

  // Function settings dəyişdikdə localStorage-a saxla
  useEffect(() => {
    try {
      localStorage.setItem(`${pageId}-function-settings`, JSON.stringify(functionSettings))
    } catch (e) {
      console.error('Function settings saxlanarkən xəta:', e)
    }
  }, [functionSettings, pageId])

  // Browser-in default kontekst menyusunu dayandır
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
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

  // Axtarış dəyişdikdə callback çağır
  useEffect(() => {
    if (onSearch) {
      onSearch(searchTerm)
    }
  }, [searchTerm, onSearch])

  // Filtr dəyişdikdə callback çağır
  useEffect(() => {
    if (onFilter) {
      onFilter(filterValue)
    }
  }, [filterValue, onFilter])

  // Seçilmiş sətirlər dəyişdikdə callback çağır
  useEffect(() => {
    if (onRowSelect) {
      onRowSelect(selectedRows)
    }
  }, [selectedRows, onRowSelect])


  // Sütunları sırala
  const sortedColumns = [...columns].sort((a, b) => a.order - b.order)

  // Sütun sürüşdürmə funksiyaları
  const handleDragStart = (columnId: string) => {
    setDraggedColumn(columnId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (draggedColumn === null || draggedColumn === targetColumnId) {
      setDraggedColumn(null)
      return
    }

    const allColumns = [...columns]
    const draggedCol = allColumns.find(col => col.id === draggedColumn)
    const targetCol = allColumns.find(col => col.id === targetColumnId)

    if (!draggedCol || !targetCol) {
      setDraggedColumn(null)
      return
    }

    const newColumns = [...allColumns]
    const draggedOrder = draggedCol.order
    const targetOrder = targetCol.order

    newColumns.forEach(col => {
      if (col.id === draggedColumn) {
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

    setColumns(newColumns)
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
      const newWidth = Math.max(50, resizeStartWidth + diff)
      
      setColumns(prev => prev.map(col => 
        col.id === resizingColumn ? { ...col, width: newWidth } : col
      ))
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

  // Sıralama funksiyası
  const handleSort = (columnId: string) => {
    setSortConfig(prev => {
      if (prev.column === columnId) {
        return {
          column: columnId,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        }
      }
      return {
        column: columnId,
        direction: 'asc'
      }
    })
  }

  // Sıralanmış məlumatlar
  const getSortedData = () => {
    if (!sortConfig.column) return data

    return [...data].sort((a, b) => {
      const column = sortedColumns.find(col => col.id === sortConfig.column)
      if (!column || !column.sortable) return 0

      const aValue = (a as any)[sortConfig.column!]
      const bValue = (b as any)[sortConfig.column!]

      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }

      const aStr = String(aValue).toLowerCase()
      const bStr = String(bValue).toLowerCase()

      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })
  }

  const sortedData = getSortedData()

  // Ctrl+A kombinasiyasını dinlə (cədvəlin bütün sətirlərini seç)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+A və ya Cmd+A (Mac üçün)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        // Yalnız cədvəlin içində və ya cədvəlin div-inə focus olduqda
        const activeElement = document.activeElement
        const isInTable = tableRef.current?.contains(activeElement) || 
                          (activeElement?.tagName === 'INPUT' && activeElement.getAttribute('type') === 'checkbox') ||
                          activeElement?.closest('table') !== null
        
        if (isInTable && tableRef.current) {
          e.preventDefault()
          e.stopPropagation()
          
          // Cədvəlin bütün sətirlərini seç
          const allIds = sortedData.map(row => getRowId(row))
          setSelectedRows(allIds)
        }
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [sortedData, getRowId])

  // Row seçimi funksiyaları
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = sortedData.map(row => getRowId(row))
      setSelectedRows(allIds)
    } else {
      setSelectedRows([])
    }
  }

  const handleSelectRow = (id: number | string, event?: React.MouseEvent) => {
    const isCtrlPressed = event?.ctrlKey || event?.metaKey
    
    if (!functionSettings.multiSelect && !isCtrlPressed) {
      setSelectedRows([id])
      return
    }

    if (functionSettings.ctrlClickMultiSelect && !isCtrlPressed) {
      setSelectedRows([id])
      return
    }

    setSelectedRows(prev => {
      if (prev.includes(id)) {
        return prev.filter(rowId => rowId !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  // Toolbar funksiyaları
  const handleEdit = () => {
    if (toolbarActions?.onEdit && selectedRows.length === 1) {
      toolbarActions.onEdit(selectedRows)
    }
  }

  const handleDelete = () => {
    if (toolbarActions?.onDelete && selectedRows.length > 0) {
      if (!functionSettings.deleteEnabled) {
        alert('Delete funksiyası deaktivdir. Ayarlardan aktivləşdirin.')
        return
      }
      toolbarActions.onDelete(selectedRows)
    }
  }

  const handleCopy = () => {
    if (toolbarActions?.onCopy && selectedRows.length > 0) {
      toolbarActions.onCopy(selectedRows)
    }
  }

  const handlePrint = () => {
    if (toolbarActions?.onPrint) {
      toolbarActions.onPrint()
    } else {
      window.print()
    }
  }

  // Görünən sütunlar
  const visibleColumns = sortedColumns.filter(col => col.visible || col.id === 'checkbox')

  return (
    <div style={{ padding: '0.5rem 1rem', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: 0 }}>
      {title && <h1 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>{title}</h1>}

      {/* Toolbar */}
      <div style={{
        background: '#f5f5f5',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        marginBottom: '0.75rem',
        display: 'flex',
        gap: '0.5rem',
        flexWrap: 'wrap',
        alignItems: 'center',
        border: '1px solid #ddd',
        flexShrink: 0,
        position: 'sticky',
        top: '64px',
        zIndex: 100
      }}>
        {/* Sol toolbar elementləri */}
        {leftToolbarItems}

        {/* Axtarış */}
        {onSearch && (
          <div style={{ flex: '1', minWidth: '200px', position: 'relative' }}>
            {activeSearchColumn && (
              <div style={{
                position: 'absolute',
                left: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: '#007bff',
                color: 'white',
                padding: '0.125rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                zIndex: 1,
                pointerEvents: 'none'
              }}>
                <span>{columns.find(c => c.id === activeSearchColumn)?.label || activeSearchColumn}</span>
                {onActiveSearchColumnChange && (
                  <button
                    onClick={(e) => {
                      console.log('[DataTable] X düyməsi basıldı, sütun filtrini ləğv edir')
                      e.stopPropagation()
                      onActiveSearchColumnChange(null)
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      padding: '0',
                      marginLeft: '0.25rem',
                      fontSize: '0.875rem',
                      lineHeight: '1',
                      pointerEvents: 'auto'
                    }}
                    title="Sütun filtrini ləğv et"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
            <div style={{ position: 'relative', width: '100%' }}>
              {(() => {
                const showColumnLabel = activeSearchColumn && searchTerm === ''
                console.log('[DataTable] Render - activeSearchColumn:', activeSearchColumn, 'searchTerm:', searchTerm, 'showColumnLabel:', showColumnLabel)
                const columnLabel = activeSearchColumn ? columns.find(c => c.id === activeSearchColumn)?.label || activeSearchColumn : null
                console.log('[DataTable] Render - columnLabel:', columnLabel)
                return showColumnLabel ? (
                  <div style={{
                    position: 'absolute',
                    left: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#999',
                    pointerEvents: 'none',
                    fontSize: '1rem',
                    zIndex: 1,
                    whiteSpace: 'nowrap',
                    maxWidth: 'calc(100% - 2rem)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    🔍 {columnLabel} üzrə axtarış...
                  </div>
                ) : null
              })()}
              <input
                type="text"
                placeholder={!activeSearchColumn ? "🔍 Axtarış... (Ctrl+F)" : ""}
                value={searchTerm}
                onChange={(e) => {
                  console.log('[DataTable] Axtarış dəyəri dəyişdi:', e.target.value, 'activeSearchColumn:', activeSearchColumn)
                  setSearchTerm(e.target.value)
                }}
                onFocus={() => {
                  console.log('[DataTable] Axtarış input focus oldu, activeSearchColumn:', activeSearchColumn, 'searchTerm:', searchTerm)
                  // Focus olduqda yazı itir (searchTerm boş olmadıqda), amma sütun aktiv qalır
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  paddingLeft: activeSearchColumn && searchTerm === '' ? 'calc(0.5rem + 180px)' : '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  background: 'transparent',
                  position: 'relative',
                  zIndex: 2
                }}
              />
            </div>
          </div>
        )}

        {/* Filtr */}
        {onFilter && (
          <select
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
          >
            <option value="">Bütün</option>
          </select>
        )}

        {/* Toolbar düymələri */}
        {toolbarActions?.onSettings !== undefined && (
          <button
            onClick={() => {
              setShowSettings(true)
              if (toolbarActions?.onSettings) {
                toolbarActions.onSettings()
              }
            }}
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
        )}

        {toolbarActions?.onEdit && (
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
            title={selectedRows.length === 1 ? 'Redaktə (F2)' : 'Bir element seçin'}
          >
            ✏️ Redaktə
          </button>
        )}

        {toolbarActions?.onDelete && (
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
            title="Sil (Delete)"
          >
            🗑️ Sil
          </button>
        )}

        {toolbarActions?.onCopy && (
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
            title="Kopyala (F9)"
          >
            📋 Kopyala
          </button>
        )}

        {toolbarActions?.onPrint && (
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
            title="Çap et (Ctrl+P)"
          >
            🖨️ Çap
          </button>
        )}

        {/* Custom actions */}
        {toolbarActions?.customActions}

        {/* Sağ toolbar elementləri */}
        {rightToolbarItems}
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
          ref={tableRef}
          style={{ flex: 1, overflow: 'auto', border: '1px solid #ddd', borderRadius: '8px', minHeight: 0 }}
          tabIndex={0}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setContextMenu({
              visible: true,
              x: e.clientX,
              y: e.clientY
            })
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                {visibleColumns.map((column) => {
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
                          checked={selectedRows.length === sortedData.length && sortedData.length > 0}
                          onChange={handleSelectAll}
                        />
                      </th>
                    )
                  }

                  const isSortable = column.sortable !== false
                  const isSorted = sortConfig.column === column.id
                  const isDragging = draggedColumn === column.id
                  const align = column.align || 'left'

                  return (
                    <th
                      key={column.id}
                      data-column-id={column.id}
                      draggable={true}
                      onDragStart={() => handleDragStart(column.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, column.id)}
                      onDragEnd={handleDragEnd}
                      onMouseDown={(e) => {
                        console.log('[DataTable] Sütun header onMouseDown:', column.id, 'target:', e.target, 'currentTarget:', e.currentTarget)
                        // Event-in row-a düşməsinin qarşısını al
                        e.stopPropagation()
                        // Resize handle-a klikləyibsə, return et
                        if ((e.target as HTMLElement).closest('[data-resize-handle]')) {
                          console.log('[DataTable] Resize handle-a klikləndi, return edilir')
                          return
                        }
                        // Sütun header-ına klikləyəndə callback çağır (mouseDown-da çağır)
                        if (onColumnHeaderClick && column.id !== 'checkbox' && column.id !== 'is_active_status') {
                          console.log('[DataTable] Sütun header onMouseDown-dan callback çağırılır:', column.id)
                          try {
                            onColumnHeaderClick(column.id)
                            console.log('[DataTable] Callback çağırıldı (onMouseDown):', column.id)
                          } catch (error) {
                            console.error('[DataTable] Callback xətası:', error)
                          }
                        }
                      }}
                      onClick={(e) => {
                        console.log('[DataTable] Sütun header onClick başladı:', column.id, 'target:', e.target, 'currentTarget:', e.currentTarget, 'onColumnHeaderClick:', !!onColumnHeaderClick)
                        console.log('[DataTable] onClick event details - type:', e.type, 'bubbles:', e.bubbles, 'cancelable:', e.cancelable)
                        
                        // Event-in row-a düşməsinin qarşısını al (vacibdir!)
                        e.stopPropagation()
                        e.preventDefault()
                        
                        // Resize handle-a klikləyibsə, return et
                        if ((e.target as HTMLElement).closest('[data-resize-handle]')) {
                          console.log('[DataTable] Resize handle-a klikləndi, return edilir')
                          return
                        }
                        
                        // Sütun header-ına klikləyəndə callback çağır (həmişə çağır, sort-dan əvvəl)
                        if (onColumnHeaderClick && column.id !== 'checkbox' && column.id !== 'is_active_status') {
                          console.log('[DataTable] Sütun header-ına klikləndi, callback çağırılır:', column.id)
                          try {
                            onColumnHeaderClick(column.id)
                            console.log('[DataTable] Callback çağırıldı:', column.id)
                          } catch (error) {
                            console.error('[DataTable] Callback xətası:', error)
                          }
                        } else {
                          console.log('[DataTable] Callback çağırılmadı - onColumnHeaderClick:', !!onColumnHeaderClick, 'column.id:', column.id, 'is checkbox:', column.id === 'checkbox', 'is is_active_status:', column.id === 'is_active_status')
                        }
                        
                        // Sort funksiyasını çağır
                        if (isSortable) {
                          console.log('[DataTable] handleSort çağırılır:', column.id)
                          handleSort(column.id)
                        }
                      }}
                      onMouseUp={(e) => {
                        console.log('[DataTable] Sütun header onMouseUp:', column.id, 'target:', e.target)
                      }}
                      style={{
                        padding: '0.75rem',
                        textAlign: align,
                        borderRight: '1px solid #dee2e6',
                        width: column.width,
                        minWidth: column.width,
                        cursor: isSortable ? 'pointer' : 'default',
                        userSelect: 'text', // Mətn seçilə bilsin
                        background: isSorted ? '#e3f2fd' : isDragging ? '#e0e0e0' : undefined,
                        position: 'relative',
                        opacity: isDragging ? 0.5 : 1
                      }}
                      title={isSortable ? 'Sıralamaq üçün klikləyin, sürüşdürmək üçün drag edin' : ''}
                    >
                      <div 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.5rem', 
                          justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
                          position: 'relative',
                          pointerEvents: 'auto'
                        }}
                        onMouseDown={(e) => {
                          console.log('[DataTable] Header div onMouseDown:', column.id, 'target:', e.target, 'currentTarget:', e.currentTarget)
                          // Event-in row-a düşməsinin qarşısını al
                          e.stopPropagation()
                          // Resize handle-a klikləyibsə, return et
                          if ((e.target as HTMLElement).closest('[data-resize-handle]')) {
                            return
                          }
                          // Sütun header-ına klikləyəndə callback çağır (mouseDown-da çağır)
                          if (onColumnHeaderClick && column.id !== 'checkbox' && column.id !== 'is_active_status') {
                            console.log('[DataTable] Header div onMouseDown-dan callback çağırılır:', column.id)
                            try {
                              onColumnHeaderClick(column.id)
                              console.log('[DataTable] Callback çağırıldı (div onMouseDown):', column.id)
                            } catch (error) {
                              console.error('[DataTable] Callback xətası:', error)
                            }
                          }
                        }}
                        onClick={(e) => {
                          console.log('[DataTable] Header div onClick:', column.id, 'target:', e.target, 'currentTarget:', e.currentTarget)
                          // Event-in row-a düşməsinin qarşısını al (vacibdir!)
                          e.stopPropagation()
                          e.preventDefault()
                          // Birbaşa callback-i çağır
                          if (onColumnHeaderClick && column.id !== 'checkbox' && column.id !== 'is_active_status') {
                            console.log('[DataTable] Header div-dən callback çağırılır:', column.id)
                            try {
                              onColumnHeaderClick(column.id)
                              console.log('[DataTable] Callback çağırıldı (div onClick):', column.id)
                            } catch (error) {
                              console.error('[DataTable] Callback xətası:', error)
                            }
                          }
                        }}
                      >
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
                      <div
                        data-resize-handle
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          handleResizeStart(e, column.id)
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '4px',
                          height: '100%',
                          cursor: 'col-resize',
                          background: resizingColumn === column.id ? '#007bff' : 'transparent'
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
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                    Məlumat tapılmadı
                  </td>
                </tr>
              ) : (
                sortedData.map((row) => {
                  const rowId = getRowId(row)
                  const isSelected = selectedRows.includes(rowId)

                  return (
                    <tr
                      key={rowId}
                      onDoubleClick={(e) => {
                        // Dubl klik zamanı sənədi aç
                        if (onRowClick) {
                          onRowClick(row, rowId)
                        }
                      }}
                      onClick={(e) => {
                        // Mətn seçimi zamanı row click-i işləməsin
                        if (window.getSelection()?.toString()) {
                          return
                        }
                        handleSelectRow(rowId, e)
                      }}
                      style={{
                        borderBottom: '1px solid #dee2e6',
                        background: isSelected ? '#e7f3ff' : 'white',
                        cursor: 'pointer'
                      }}
                    >
                      {visibleColumns.map((column) => {
                        if (column.id === 'checkbox') {
                          return (
                            <td
                              key={column.id}
                              style={{
                                padding: '0.75rem',
                                borderRight: '1px solid #dee2e6',
                                textAlign: 'left',
                                width: column.width
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectRow(rowId)}
                              />
                            </td>
                          )
                        }

                        const align = column.align || 'left'
                        const cellValue = (row as any)[column.id]
                        const cellContent = column.render ? column.render(cellValue, row) : cellValue

                        return (
                          <td
                            key={column.id}
                            ref={(el) => {
                              // Hücrəyə ref əlavə et ki, mətn seçimini idarə edək
                              if (el) {
                                (el as any).__cellContent = cellContent
                              }
                            }}
                            style={{
                              padding: '0.75rem',
                              borderRight: '1px solid #dee2e6',
                              textAlign: align,
                              width: column.width,
                              userSelect: 'text' // Mətn seçilə bilsin
                            }}
                            onMouseDown={(e) => {
                              // Mətn seçimi zamanı row click-i işləməsin
                              const selection = window.getSelection()
                              if (selection && selection.toString().length > 0) {
                                e.stopPropagation()
                              }
                            }}
                            onClick={(e) => {
                              // Dubl klik zamanı seçim etmə (dubl klik sənədi açır)
                              if (e.detail === 2) {
                                return
                              }
                              
                              // Hücrəyə klikləyəndə, həmin hücrənin bütün mətnini seç
                              const target = e.currentTarget as HTMLElement
                              const selection = window.getSelection()
                              
                              // Əgər mətn artıq seçilibsə, row click-i işlətmə
                              if (selection && selection.toString().length > 0) {
                                e.stopPropagation()
                                return
                              }
                              
                              // Hücrənin bütün mətnini seç
                              const range = document.createRange()
                              try {
                                range.selectNodeContents(target)
                                selection?.removeAllRanges()
                                selection?.addRange(range)
                              } catch (err) {
                                // Əgər seçim uğursuz olarsa, sadəcə event-i blokla
                                console.warn('Mətn seçimi uğursuz oldu:', err)
                              }
                              
                              // Hücrəyə klikləyəndə event-in row-a düşməsinin qarşısını al
                              e.stopPropagation()
                            }}
                            onDoubleClick={(e) => {
                              // Dubl klik zamanı event-i row-a ötür (dubl klik sənədi açır)
                              // Amma mətn seçilibsə, ötürmə
                              const selection = window.getSelection()
                              if (selection && selection.toString().length > 0) {
                                e.stopPropagation()
                              }
                            }}
                            onMouseUp={(e) => {
                              // Mətn seçimi zamanı row click-i işləməsin
                              const selection = window.getSelection()
                              if (selection && selection.toString().length > 0) {
                                e.stopPropagation()
                              }
                            }}
                          >
                            {cellContent}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Seçilmiş sətirlər sayı */}
      {selectedRows.length > 0 && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: '#e7f3ff',
          borderRadius: '4px',
          color: '#004085'
        }}>
          {selectedRows.length} element seçilib
        </div>
      )}

      {/* Kontekst Menyu */}
      {contextMenu.visible && contextMenuActions && (
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
          {contextMenuActions.onSettings !== undefined && (
            <div
              onClick={() => {
                setShowSettings(true)
                if (contextMenuActions?.onSettings) {
                  contextMenuActions.onSettings()
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
              ⚙️ Ayarlar
            </div>
          )}
          {contextMenuActions.onEdit && (
            <div
              onClick={() => {
                if (selectedRows.length === 1 && contextMenuActions?.onEdit) {
                  contextMenuActions.onEdit(selectedRows)
                }
                setContextMenu({ ...contextMenu, visible: false })
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
          )}
          {contextMenuActions.onDelete && (
            <div
              onClick={() => {
                if (selectedRows.length > 0 && contextMenuActions?.onDelete) {
                  contextMenuActions.onDelete(selectedRows)
                }
                setContextMenu({ ...contextMenu, visible: false })
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
          )}
          {contextMenuActions.onCopy && (
            <div
              onClick={() => {
                if (selectedRows.length > 0 && contextMenuActions?.onCopy) {
                  contextMenuActions.onCopy(selectedRows)
                }
                setContextMenu({ ...contextMenu, visible: false })
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
          )}
          {contextMenuActions.onSearch && (
            <div
              onClick={() => {
                if (contextMenuActions?.onSearch) {
                  contextMenuActions.onSearch()
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
          )}
          {contextMenuActions.onFilter && (
            <div
              onClick={() => {
                if (contextMenuActions?.onFilter) {
                  contextMenuActions.onFilter()
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
          )}
          {contextMenuActions.onActivate && (
            <div
              onClick={() => {
                if (selectedRows.length > 0 && contextMenuActions?.onActivate) {
                  contextMenuActions.onActivate(selectedRows)
                }
                setContextMenu({ ...contextMenu, visible: false })
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
            </div>
          )}
          {contextMenuActions.onDeactivate && (
            <div
              onClick={() => {
                if (selectedRows.length > 0 && contextMenuActions?.onDeactivate) {
                  contextMenuActions.onDeactivate(selectedRows)
                }
                setContextMenu({ ...contextMenu, visible: false })
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
              <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>📄</span>
              Deaktiv et
            </div>
          )}
          {contextMenuActions.onPrint && (
            <div
              onClick={() => {
                if (contextMenuActions?.onPrint) {
                  contextMenuActions.onPrint()
                } else {
                  handlePrint()
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
              🖨️ Çap
            </div>
          )}
          {contextMenuActions.customItems?.map((item, index) => (
            <div
              key={index}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick()
                }
                setContextMenu({ ...contextMenu, visible: false })
              }}
              style={{
                padding: '0.5rem 1rem',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                opacity: item.disabled ? 0.5 : 1,
                borderBottom: index < (contextMenuActions.customItems?.length || 0) - 1 ? '1px solid #eee' : 'none'
              }}
              onMouseEnter={(e) => {
                if (!item.disabled) {
                  e.currentTarget.style.background = '#f0f0f0'
                }
              }}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
            >
              {item.icon && <span>{item.icon} </span>}
              {item.label}
            </div>
          ))}
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
              maxWidth: '700px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem' }}>Cədvəl Ayarları</h2>

            {/* Tab-lar */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid #dee2e6' }}>
              <button
                onClick={() => setSettingsTab('columns')}
                style={{
                  padding: '0.5rem 1rem',
                  background: settingsTab === 'columns' ? '#007bff' : 'transparent',
                  color: settingsTab === 'columns' ? 'white' : '#007bff',
                  border: 'none',
                  borderBottom: settingsTab === 'columns' ? '2px solid #007bff' : '2px solid transparent',
                  borderRadius: '4px 4px 0 0',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: settingsTab === 'columns' ? 'bold' : 'normal'
                }}
              >
                Sütunlar
              </button>
              <button
                onClick={() => setSettingsTab('functions')}
                style={{
                  padding: '0.5rem 1rem',
                  background: settingsTab === 'functions' ? '#007bff' : 'transparent',
                  color: settingsTab === 'functions' ? 'white' : '#007bff',
                  border: 'none',
                  borderBottom: settingsTab === 'functions' ? '2px solid #007bff' : '2px solid transparent',
                  borderRadius: '4px 4px 0 0',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: settingsTab === 'functions' ? 'bold' : 'normal'
                }}
              >
                Funksiyalar
              </button>
            </div>

            {/* Sütunlar tab */}
            {settingsTab === 'columns' && (
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Görünən sütunlar</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {sortedColumns.filter(col => col.id !== 'checkbox').map((column) => (
                    <label
                      key={column.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        background: column.visible ? '#f8f9fa' : 'transparent'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={column.visible}
                        onChange={(e) => {
                          setColumns(columns.map(col =>
                            col.id === column.id ? { ...col, visible: e.target.checked } : col
                          ))
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Funksiyalar tab */}
            {settingsTab === 'functions' && (
              <div>
                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Funksiya ayarları</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={functionSettings.multiSelect}
                      onChange={(e) => {
                        setFunctionSettings({
                          ...functionSettings,
                          multiSelect: e.target.checked
                        })
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Çoxlu seçim (Multi-select)</span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={functionSettings.ctrlClickMultiSelect}
                      onChange={(e) => {
                        setFunctionSettings({
                          ...functionSettings,
                          ctrlClickMultiSelect: e.target.checked
                        })
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Ctrl+Click ilə çoxlu seçim</span>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={functionSettings.deleteEnabled}
                      onChange={(e) => {
                        setFunctionSettings({
                          ...functionSettings,
                          deleteEnabled: e.target.checked
                        })
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Sil funksiyası aktivdir</span>
                  </label>
                </div>
              </div>
            )}

            {/* Düymələr */}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
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
    </div>
  )
}

