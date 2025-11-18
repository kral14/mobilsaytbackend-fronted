import React, { useState, useEffect } from 'react'
import { useWindowStore } from '../store/windowStore'
import type { Supplier, Product } from '@shared/types'

export interface PurchaseInvoiceItem {
  product_id: number | null
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  searchTerm?: string // Məhsul axtarışı üçün
}

export interface PurchaseModalData {
  id: string
  invoiceId: number | null
  position: { x: number, y: number }
  size: { width: number, height: number }
  isMaximized: boolean
  zIndex: number
  data: {
    selectedSupplierId: number | null
    selectedSupplier: Supplier | null
    invoiceItems: PurchaseInvoiceItem[]
    notes: string
  }
}

interface PurchaseInvoiceModalProps {
  modal: PurchaseModalData
  suppliers: Supplier[]
  products: Product[]
  modalIndex: number
  isActive: boolean
  onClose: (modalId: string) => void
  onUpdate: (modalId: string, updates: Partial<PurchaseModalData>) => void
  onSave: (modalId: string, modalData: PurchaseModalData['data']) => Promise<void>
  onActivate: (modalId: string) => void
  windowId: string
}

const PurchaseInvoiceModal: React.FC<PurchaseInvoiceModalProps> = ({ 
  modal, 
  suppliers, 
  products, 
  modalIndex, 
  isActive, 
  onClose, 
  onUpdate, 
  onSave, 
  onActivate, 
  windowId 
}) => {
  const [localData, setLocalData] = useState(modal.data)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 })
  
  // Window store
  const { windows, minimizeWindow, restoreWindow } = useWindowStore()
  const windowInfo = windows.get(windowId)
  const isMinimized = windowInfo?.isMinimized || false
  const isVisible = windowInfo?.isVisible !== false
  
  // Form state-ləri
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('')
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [selectedItemIndices, setSelectedItemIndices] = useState<number[]>([])
  
  // Filtered lists
  const filteredSuppliers = React.useMemo(() => {
    if (!supplierSearchTerm.trim()) return []
    const term = supplierSearchTerm.toLowerCase()
    return suppliers.filter(supplier =>
      supplier.name.toLowerCase().includes(term) ||
      supplier.phone?.toLowerCase().includes(term) ||
      supplier.email?.toLowerCase().includes(term)
    ).slice(0, 10)
  }, [suppliers, supplierSearchTerm])
  
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
  
  const handleProductSelectInRow = (index: number, productId: number) => {
    const product = products.find(p => p.id === productId)
    if (!product) return

    const updatedItems = [...localData.invoiceItems]
    updatedItems[index] = {
      ...updatedItems[index],
      product_id: productId,
      product_name: product.name,
      unit_price: Number(product.purchase_price) || 0,
      total_price: updatedItems[index].quantity * (Number(product.purchase_price) || 0),
      searchTerm: ''
    }
    setLocalData({ ...localData, invoiceItems: updatedItems })
  }

  const handleProductSearchInRow = (index: number, searchTerm: string) => {
    const updatedItems = [...localData.invoiceItems]
    updatedItems[index] = {
      ...updatedItems[index],
      searchTerm: searchTerm
    }
    setLocalData({ ...localData, invoiceItems: updatedItems })
  }

  const getFilteredProductsForRow = (searchTerm: string) => {
    if (!searchTerm.trim()) return []
    const term = searchTerm.toLowerCase()
    return products.filter(product =>
      product.name.toLowerCase().includes(term) ||
      product.code?.toLowerCase().includes(term) ||
      product.barcode?.toLowerCase().includes(term)
    ).slice(0, 10)
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
  
  const handleRemoveSelectedItems = () => {
    if (selectedItemIndices.length === 0) {
      alert('Sətir seçilməyib')
      return
    }
    const sortedIndices = [...selectedItemIndices].sort((a, b) => b - a)
    const newItems = [...localData.invoiceItems]
    sortedIndices.forEach(index => {
      newItems.splice(index, 1)
    })
    setLocalData({ ...localData, invoiceItems: newItems })
    setSelectedItemIndices([])
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
  
  // Modal açılanda məlumatları yenilə
  useEffect(() => {
    setLocalData(modal.data)
    if (modal.data.selectedSupplier) {
      setSupplierSearchTerm('')
    }
  }, [modal.data])
  
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.classList.contains('modal-header') || target.closest('.modal-header')) {
      if (target.tagName === 'BUTTON' || target.closest('button')) return
      setIsDragging(true)
      setDragStart({ x: e.clientX - modal.position.x, y: e.clientY - modal.position.y })
    }
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    setResizeStart({ x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !modal.isMaximized) {
        const newX = Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - modal.size.width))
        const newY = Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - modal.size.height))
        onUpdate(modal.id, { position: { x: newX, y: newY } })
      }
      if (isResizing && !modal.isMaximized) {
        const deltaX = e.clientX - resizeStart.x
        const deltaY = e.clientY - resizeStart.y
        const newWidth = Math.max(500, Math.min(modal.size.width + deltaX, window.innerWidth - modal.position.x))
        const newHeight = Math.max(400, Math.min(modal.size.height + deltaY, window.innerHeight - modal.position.y))
        onUpdate(modal.id, { size: { width: newWidth, height: newHeight } })
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
  }, [isDragging, isResizing, dragStart, resizeStart, modal, onUpdate])

  const handleMaximize = () => {
    if (!modal.isMaximized) {
      onUpdate(modal.id, {
        isMaximized: true,
        position: { x: 0, y: 0 },
        size: { width: window.innerWidth, height: window.innerHeight }
      })
    } else {
      const savedSize = localStorage.getItem('alis-qaime-modal-size')
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

  // Minimize olunmuşsa göstərmə
  if (isMinimized || !isVisible) {
    return null
  }
  
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.3)',
        zIndex: modal.zIndex,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: `${modal.position.x}px`,
          top: `${modal.position.y}px`,
          width: `${modal.size.width}px`,
          height: `${modal.size.height}px`,
          background: 'white',
          borderRadius: '8px',
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
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>
            {modal.invoiceId ? `Qaimə #${modal.invoiceId}` : 'Yeni Alış Qaiməsi'}
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={handleMaximize}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1rem',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                color: '#666',
                width: '28px',
                height: '28px',
                borderRadius: '4px',
              }}
              title={modal.isMaximized ? "Bərpa et" : "Böyüt"}
            >
              {modal.isMaximized ? '⧉' : '□'}
            </button>
            <button
              onClick={() => {
                minimizeWindow(windowId)
                onUpdate(modal.id, { isMaximized: false })
              }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                color: '#666',
                width: '28px',
                height: '28px',
                borderRadius: '4px',
              }}
              title="Aşağı göndər"
            >
              _
            </button>
            <button
              onClick={() => onClose(modal.id)}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                color: '#666',
                width: '28px',
                height: '28px',
                borderRadius: '4px',
              }}
              title="Bağla"
            >
              ×
            </button>
          </div>
        </div>
        
        {/* Modal məzmunu */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '1.5rem', minHeight: 0 }}>
          {/* Təchizatçı seçimi */}
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Təchizatçı
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Təchizatçı adını yazın... (F4 - siyahı)"
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
            {localData.selectedSupplier && (
              <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#e7f3ff', borderRadius: '4px', fontSize: '0.875rem' }}>
                <strong>{localData.selectedSupplier.name}</strong>
                {localData.selectedSupplier.phone && <span> - {localData.selectedSupplier.phone}</span>}
              </div>
            )}
          </div>

          {/* Məhsul siyahısı */}
          <div style={{ marginBottom: '1rem', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ background: '#f8f9fa', padding: '0.75rem', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 'bold' }}>Məhsullar ({localData.invoiceItems.length})</div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleAddEmptyRow}
                  style={{
                    padding: '0.5rem',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}
                >
                  ➕ Əlavə et
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
                >
                  🗑️ Sil
                </button>
              </div>
            </div>
            <div style={{ maxHeight: '300px', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', position: 'sticky', top: 0, zIndex: 10 }}>
                    <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center', fontSize: '0.875rem', width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedItemIndices.length === localData.invoiceItems.length && localData.invoiceItems.length > 0}
                        onChange={handleSelectAllItems}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left', fontSize: '0.875rem' }}>№</th>
                    <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'left', fontSize: '0.875rem' }}>Məhsul</th>
                    <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.875rem' }}>Miqdar</th>
                    <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.875rem' }}>Vahid qiymət</th>
                    <th style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right', fontSize: '0.875rem' }}>Cəm</th>
                  </tr>
                </thead>
                <tbody>
                  {localData.invoiceItems.map((item, index) => {
                    const rowProducts = getFilteredProductsForRow(item.searchTerm || '')
                    const isSelected = selectedItemIndices.includes(index)
                    return (
                      <tr 
                        key={index} 
                        onClick={(e) => {
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
                        <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center' }}>{index + 1}</td>
                        <td style={{ padding: '0.75rem', border: '1px solid #ddd', position: 'relative' }}>
                          {item.product_id ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{item.product_name}</span>
                              <button
                                onClick={() => {
                                  const updatedItems = [...localData.invoiceItems]
                                  updatedItems[index] = {
                                    ...updatedItems[index],
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
                                onChange={(e) => handleProductSearchInRow(index, e.target.value)}
                                onBlur={(e) => {
                                  setTimeout(() => {
                                    const relatedTarget = e.relatedTarget as HTMLElement
                                    if (!relatedTarget || !relatedTarget.closest('.product-dropdown')) {
                                      const updatedItems = [...localData.invoiceItems]
                                      updatedItems[index] = {
                                        ...updatedItems[index],
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
                                      {product.purchase_price && (
                                        <div style={{ fontSize: '0.875rem', color: '#28a745', fontWeight: 'bold', marginTop: '0.25rem' }}>
                                          Qiymət: {Number(product.purchase_price).toFixed(2)} ₼
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
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
                        <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold' }}>
                          {item.total_price.toFixed(2)} ₼
                        </td>
                      </tr>
                    )
                  })}
                  {localData.invoiceItems.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
                        Məhsul yoxdur. Əlavə edin.
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#e7f3ff', fontWeight: 'bold' }}>
                    <td colSpan={5} style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'right' }}>Ümumi:</td>
                    <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'right' }}>{Number(totalAmount || 0).toFixed(2)} ₼</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Qeydlər */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Qeydlər
            </label>
            <textarea
              value={localData.notes}
              onChange={(e) => setLocalData({ ...localData, notes: e.target.value })}
              placeholder="Qeydlər..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                resize: 'vertical'
              }}
            />
          </div>
        </div>

        {/* Düymələr */}
        <div style={{ padding: '1rem', borderTop: '1px solid #ddd', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button
            onClick={() => onClose(modal.id)}
            style={{
              padding: '0.5rem 1.5rem',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Bağla
          </button>
          <button
            onClick={() => onSave(modal.id, localData)}
            disabled={localData.invoiceItems.filter(item => item.product_id !== null).length === 0}
            style={{
              padding: '0.5rem 1.5rem',
              background: localData.invoiceItems.filter(item => item.product_id !== null).length === 0 ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: localData.invoiceItems.filter(item => item.product_id !== null).length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Yadda Saxla
          </button>
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

export default PurchaseInvoiceModal

