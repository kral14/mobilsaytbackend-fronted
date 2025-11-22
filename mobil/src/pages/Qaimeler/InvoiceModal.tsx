import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import type { PurchaseInvoice, SaleInvoice, Product, Supplier, Customer } from '@shared/types'

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

interface InvoiceForm {
  supplier_id?: number | null
  supplier_name?: string
  customer_id?: number | null
  customer_name?: string
  invoiceItems: InvoiceItem[]
  notes: string
  invoice_number: string
  invoice_date: string
  payment_date: string
}

interface InvoiceModalProps {
  show: boolean
  onClose: () => void
  selectedInvoice: PurchaseInvoice | SaleInvoice | null
  invoiceForm: InvoiceForm
  setInvoiceForm: React.Dispatch<React.SetStateAction<InvoiceForm>>
  suppliers?: Supplier[]
  supplierSearchInput?: string
  setSupplierSearchInput?: React.Dispatch<React.SetStateAction<string>>
  filteredSuppliersForInput?: Supplier[]
  setFilteredSuppliersForInput?: React.Dispatch<React.SetStateAction<Supplier[]>>
  customers?: Customer[]
  customerSearchInput?: string
  setCustomerSearchInput?: React.Dispatch<React.SetStateAction<string>>
  filteredCustomersForInput?: Customer[]
  setFilteredCustomersForInput?: React.Dispatch<React.SetStateAction<Customer[]>>
  invoiceDateFocused: boolean
  setInvoiceDateFocused: React.Dispatch<React.SetStateAction<boolean>>
  paymentDateFocused: boolean
  setPaymentDateFocused: React.Dispatch<React.SetStateAction<boolean>>
  setShowSupplierModal?: React.Dispatch<React.SetStateAction<boolean>>
  setShowCustomerModal?: React.Dispatch<React.SetStateAction<boolean>>
  handleSaveInvoice: () => Promise<void>
  handleSaveAndConfirm: () => Promise<void>
  handleAddEmptyRow: () => void
  handleDeleteItems: () => void
  handleCopyItems: () => void
  handleMoveItemUp: () => void
  handleMoveItemDown: () => void
  handleItemProductSearch: (index: number, searchText: string) => void
  handleSelectItemProduct: (index: number, product: Product) => void
  handleUpdateItem: (index: number, field: keyof InvoiceItem, value: number | string) => void
  selectedItemIndices: Set<number>
  setSelectedItemIndices: React.Dispatch<React.SetStateAction<Set<number>>>
  itemMultiSelectMode: boolean
  setItemMultiSelectMode: React.Dispatch<React.SetStateAction<boolean>>
  itemProductSearch: Record<number, string>
  setItemProductSearch: React.Dispatch<React.SetStateAction<Record<number, string>>>
  itemFilteredProducts: Record<number, Product[]>
  setItemFilteredProducts: React.Dispatch<React.SetStateAction<Record<number, Product[]>>>
  itemProductSearchFocused: Record<number, boolean>
  setItemProductSearchFocused: React.Dispatch<React.SetStateAction<Record<number, boolean>>>
  itemInputRefs: React.MutableRefObject<Map<number, HTMLInputElement>>
  itemColumnConfig: Record<string, { label: string; align?: 'left' | 'right' | 'center' }>
  itemColumnVisibility: Record<string, boolean>
  itemColumnWidths: Record<string, number>
  itemColumnOrder: string[]
  debugMode: boolean
  setDebugMode: React.Dispatch<React.SetStateAction<boolean>>
  tableCollapsed: boolean
  setTableCollapsed: React.Dispatch<React.SetStateAction<boolean>>
  getProductInfo: (productId: number | null) => Product | null | undefined
  totalAmount: number
}

export default function InvoiceModal({
  show,
  onClose,
  selectedInvoice,
  invoiceForm,
  setInvoiceForm,
  suppliers,
  supplierSearchInput,
  setSupplierSearchInput,
  filteredSuppliersForInput,
  setFilteredSuppliersForInput,
  customers,
  customerSearchInput,
  setCustomerSearchInput,
  filteredCustomersForInput,
  setFilteredCustomersForInput,
  invoiceDateFocused,
  setInvoiceDateFocused,
  paymentDateFocused,
  setPaymentDateFocused,
  setShowSupplierModal,
  setShowCustomerModal,
  handleSaveInvoice,
  handleSaveAndConfirm,
  handleAddEmptyRow,
  handleDeleteItems,
  handleCopyItems,
  handleMoveItemUp,
  handleMoveItemDown,
  handleItemProductSearch,
  handleSelectItemProduct,
  handleUpdateItem,
  selectedItemIndices,
  setSelectedItemIndices,
  itemMultiSelectMode,
  setItemMultiSelectMode,
  itemProductSearch,
  setItemProductSearch,
  itemFilteredProducts,
  setItemFilteredProducts,
  itemProductSearchFocused,
  setItemProductSearchFocused,
  itemInputRefs,
  itemColumnConfig,
  itemColumnVisibility,
  itemColumnWidths,
  itemColumnOrder,
  debugMode,
  setDebugMode,
  tableCollapsed,
  setTableCollapsed,
  getProductInfo,
  totalAmount,
}: InvoiceModalProps) {
  const [formCollapsed, setFormCollapsed] = useState(false)
  const [focusedInputs, setFocusedInputs] = useState<Record<string, boolean>>({})

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'stretch',
        zIndex: 1000,
        padding: 0,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 0,
          width: '100%',
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setFormCollapsed(!formCollapsed)}
              style={{
                background: 'transparent',
                color: '#333',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem',
                cursor: 'pointer',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: '24px',
                minHeight: '24px',
              }}
              title={formCollapsed ? 'Genişləndir' : 'Yığ'}
            >
              {formCollapsed ? '▼' : '▲'}
            </button>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
              {selectedInvoice ? 'Qaiməni Redaktə Et' : 'Yeni Alış Qaiməsi'}
            </h2>
          </div>
          <button
            onClick={onClose}
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

        {/* Form Fields - Collapsible */}
        {!formCollapsed && (
          <>
            {/* Supplier/Customer Selection */}
            <div style={{ marginBottom: '1rem', position: 'relative', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              {suppliers && supplierSearchInput !== undefined && setSupplierSearchInput && filteredSuppliersForInput && setFilteredSuppliersForInput ? (
                <>
                  <input
                    type="text"
                    value={supplierSearchInput}
                    onChange={(e) => {
                      setSupplierSearchInput(e.target.value)
                      if (e.target.value.trim()) {
                        const term = e.target.value.toLowerCase()
                        setFilteredSuppliersForInput(
                          suppliers.filter(s => s.name?.toLowerCase().includes(term))
                        )
                      } else {
                        setFilteredSuppliersForInput([])
                      }
                    }}
                    placeholder="Təchizatçı adı yazın və ya seçin"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '1rem',
                    }}
                  />
                  {filteredSuppliersForInput.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        marginTop: '0.25rem',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      }}
                    >
                      {filteredSuppliersForInput.map((supplier) => (
                        <div
                          key={supplier.id}
                          onClick={() => {
                            setInvoiceForm(prev => ({
                              ...prev,
                              supplier_id: supplier.id,
                              supplier_name: supplier.name || '',
                            }))
                            setSupplierSearchInput(supplier.name || '')
                            setFilteredSuppliersForInput([])
                          }}
                          style={{
                            padding: '0.75rem',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f0f0f0',
                            background: invoiceForm.supplier_id === supplier.id ? '#e7f3ff' : 'white',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f5f5f5'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = invoiceForm.supplier_id === supplier.id ? '#e7f3ff' : 'white'
                          }}
                        >
                          <div style={{ fontWeight: 'bold' }}>{supplier.name}</div>
                          {supplier.phone && (
                            <div style={{ fontSize: '0.85rem', color: '#666' }}>{supplier.phone}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : customers && customerSearchInput !== undefined && setCustomerSearchInput && filteredCustomersForInput && setFilteredCustomersForInput ? (
                <>
                  <input
                    type="text"
                    value={customerSearchInput}
                    onChange={(e) => {
                      setCustomerSearchInput(e.target.value)
                      if (e.target.value.trim()) {
                        const term = e.target.value.toLowerCase()
                        setFilteredCustomersForInput(
                          customers.filter(c => c.name?.toLowerCase().includes(term))
                        )
                      } else {
                        setFilteredCustomersForInput([])
                      }
                    }}
                    placeholder="Müştəri adı yazın və ya seçin"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      fontSize: '1rem',
                    }}
                  />
                  {filteredCustomersForInput.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'white',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        marginTop: '0.25rem',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      }}
                    >
                      {filteredCustomersForInput.map((customer) => (
                        <div
                          key={customer.id}
                          onClick={() => {
                            setInvoiceForm(prev => ({
                              ...prev,
                              customer_id: customer.id,
                              customer_name: customer.name || '',
                            }))
                            setCustomerSearchInput(customer.name || '')
                            setFilteredCustomersForInput([])
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
                  )}
                </>
              ) : null}
            </div>
            <button
              onClick={() => {
                if (setShowSupplierModal) setShowSupplierModal(true)
                if (setShowCustomerModal) setShowCustomerModal(true)
              }}
              style={{
                padding: '0.75rem 1rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Seç
            </button>
          </div>
        </div>

        {/* Qaimə nömrəsi */}
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            value={invoiceForm.invoice_number}
            placeholder={invoiceForm.invoice_number ? '' : 'Qaimə nömrəsi (təsdiqlənəndə yazılacaq)'}
            readOnly
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '1rem',
              background: '#f5f5f5',
              cursor: 'not-allowed',
            }}
          />
        </div>

        {/* Qaimə tarixi */}
        <div style={{ marginBottom: '1rem', position: 'relative', flexShrink: 0 }}>
          {!invoiceDateFocused && !invoiceForm.invoice_date && (
            <div
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#999',
                pointerEvents: 'none',
                fontSize: '1rem',
                zIndex: 1,
              }}
            >
              Qaimə tarixi
            </div>
          )}
          <input
            type="datetime-local"
            value={invoiceForm.invoice_date || ''}
            onChange={(e) => {
              setInvoiceForm(prev => ({ ...prev, invoice_date: e.target.value }))
              setInvoiceDateFocused(true)
            }}
            onFocus={() => {
              setInvoiceDateFocused(true)
              if (!invoiceForm.invoice_date) {
                const now = new Date()
                const year = now.getFullYear()
                const month = String(now.getMonth() + 1).padStart(2, '0')
                const day = String(now.getDate()).padStart(2, '0')
                const hours = String(now.getHours()).padStart(2, '0')
                const minutes = String(now.getMinutes()).padStart(2, '0')
                const seconds = String(now.getSeconds()).padStart(2, '0')
                const invoiceDateStr = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`
                setInvoiceForm(prev => ({ ...prev, invoice_date: invoiceDateStr }))
              }
            }}
            onBlur={() => {
              if (invoiceForm.invoice_date) {
                setInvoiceDateFocused(true)
              } else {
                setInvoiceDateFocused(false)
              }
            }}
            step="1"
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '1rem',
              color: (!invoiceDateFocused && !invoiceForm.invoice_date) ? 'transparent' : 'inherit',
              backgroundColor: 'white',
            }}
          />
        </div>

        {/* Ödəniş tarixi */}
        <div style={{ marginBottom: '1rem', position: 'relative', flexShrink: 0 }}>
          {!paymentDateFocused && !invoiceForm.payment_date && (
            <div
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#999',
                pointerEvents: 'none',
                fontSize: '1rem',
                zIndex: 1,
              }}
            >
              Ödəniş tarixi
            </div>
          )}
          <input
            type="date"
            value={invoiceForm.payment_date || ''}
            onChange={(e) => {
              setInvoiceForm(prev => ({ ...prev, payment_date: e.target.value }))
              setPaymentDateFocused(true)
            }}
            onFocus={() => {
              setPaymentDateFocused(true)
              if (!invoiceForm.payment_date) {
                const now = new Date()
                const year = now.getFullYear()
                const month = String(now.getMonth() + 1).padStart(2, '0')
                const day = String(now.getDate()).padStart(2, '0')
                const paymentDateStr = `${year}-${month}-${day}`
                setInvoiceForm(prev => ({ ...prev, payment_date: paymentDateStr }))
              }
            }}
            onBlur={() => {
              if (invoiceForm.payment_date) {
                setPaymentDateFocused(true)
              } else {
                setPaymentDateFocused(false)
              }
            }}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '1rem',
              color: (!paymentDateFocused && !invoiceForm.payment_date) ? 'transparent' : 'inherit',
              backgroundColor: 'white',
            }}
          />
        </div>
          </>
        )}

        {/* Invoice Items */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          ...(debugMode ? { border: '3px solid red', background: 'rgba(255, 0, 0, 0.1)' } : {})
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '0.5rem', 
            flexShrink: 0,
            ...(debugMode ? { border: '2px solid blue', background: 'rgba(0, 0, 255, 0.1)', padding: '0.5rem' } : {})
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                onClick={() => setTableCollapsed(!tableCollapsed)}
                style={{
                  background: 'transparent',
                  color: '#333',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.25rem',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '24px',
                  minHeight: '24px',
                }}
                title={tableCollapsed ? 'Genişləndir' : 'Yığ'}
              >
                {tableCollapsed ? '▼' : '▲'}
              </button>
              <label style={{ fontWeight: 'bold', margin: 0 }}>Məhsullar ({invoiceForm.invoiceItems.length})</label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {debugMode && (
                <button
                  onClick={() => setDebugMode(false)}
                  style={{
                    background: '#d32f2f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '0.25rem 0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                  title="Debug mode-u bağla"
                >
                  Debug OFF
                </button>
              )}
            </div>
          </div>

          {/* Məhsullar Toolbar */}
          {!tableCollapsed && (
          <div
            style={{
              background: '#f5f7fc',
              border: '1px solid #d0d7e2',
              borderRadius: '8px',
              padding: '0.5rem 0.75rem',
              display: 'flex',
              gap: '0.35rem',
              alignItems: 'center',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              marginBottom: '0.5rem',
              flexShrink: 0,
              ...(debugMode ? { border: '2px solid green', background: 'rgba(0, 255, 0, 0.1)' } : {})
            }}
          >
            <button
              onClick={handleAddEmptyRow}
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
              title="Yeni sətir əlavə et"
            >
              ➕
            </button>
            <button
              onClick={handleDeleteItems}
              disabled={selectedItemIndices.size === 0}
              style={{
                background: selectedItemIndices.size > 0 ? '#d32f2f' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '1.25rem',
                cursor: selectedItemIndices.size > 0 ? 'pointer' : 'not-allowed',
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
              onClick={handleCopyItems}
              disabled={selectedItemIndices.size === 0}
              style={{
                background: selectedItemIndices.size > 0 ? '#1976d2' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '1.25rem',
                cursor: selectedItemIndices.size > 0 ? 'pointer' : 'not-allowed',
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
              onClick={handleMoveItemUp}
              disabled={selectedItemIndices.size === 0}
              style={{
                background: selectedItemIndices.size > 0 ? '#ff9800' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '1.25rem',
                cursor: selectedItemIndices.size > 0 ? 'pointer' : 'not-allowed',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Yuxarı"
            >
              ⬆️
            </button>
            <button
              onClick={handleMoveItemDown}
              disabled={selectedItemIndices.size === 0}
              style={{
                background: selectedItemIndices.size > 0 ? '#ff9800' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.5rem 0.75rem',
                fontSize: '1.25rem',
                cursor: selectedItemIndices.size > 0 ? 'pointer' : 'not-allowed',
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Aşağı"
            >
              ⬇️
            </button>
            <button
              onClick={() => alert('Barkod oxuma funksiyası hazırlanır...')}
              style={{
                background: '#757575',
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
              title="Barkod oxuma"
            >
              📷
            </button>
            <button
              onClick={() => alert('Papka funksiyası hazırlanır...')}
              style={{
                background: '#757575',
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
              onClick={() => alert('Ayarlar funksiyası hazırlanır...')}
              style={{
                background: '#757575',
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
          )}

          {/* Məhsullar Cədvəli */}
          {!tableCollapsed && (
          <div
            style={{ 
              border: '1px solid #ddd', 
              borderRadius: '8px', 
              overflow: 'auto', 
              height: '400px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              ...(debugMode ? { border: '3px solid orange', background: 'rgba(255, 165, 0, 0.1)' } : {})
            }}>
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem',
                  background: 'white',
                  display: 'table',
                  tableLayout: 'fixed',
                }}
              >
              <colgroup>
                {itemColumnOrder.map((columnKey) => {
                  if (!itemColumnVisibility[columnKey]) return null
                  const width = itemColumnWidths[columnKey] || 100
                  return (
                    <col
                      key={columnKey}
                      style={{ width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }}
                    />
                  )
                })}
              </colgroup>
              <thead style={debugMode ? { border: '2px solid purple', background: 'rgba(128, 0, 128, 0.1)' } : {}}>
                <tr style={{ 
                  background: '#f5f5f5', 
                  position: 'sticky', 
                  top: 0, 
                  zIndex: 10,
                  ...(debugMode ? { border: '2px solid purple', background: 'rgba(128, 0, 128, 0.2)' } : {})
                }}>
                  {itemColumnOrder.map((columnKey) => {
                    const config = itemColumnConfig[columnKey]
                    if (!config || !itemColumnVisibility[columnKey]) return null

                    const isCheckbox = columnKey === 'checkbox'
                    const width = itemColumnWidths[columnKey] || 100

                    return (
                      <th
                        key={columnKey}
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
                        }}
                      >
                        {isCheckbox ? (
                          <input
                            type="checkbox"
                            checked={selectedItemIndices.size === invoiceForm.invoiceItems.length && invoiceForm.invoiceItems.length > 0}
                            onChange={() => {
                              if (selectedItemIndices.size === invoiceForm.invoiceItems.length) {
                                setSelectedItemIndices(new Set())
                              } else {
                                setSelectedItemIndices(new Set(invoiceForm.invoiceItems.map((_, i) => i)))
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
                          config.label
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody
                style={{
                  display: 'table-row-group',
                  verticalAlign: 'top',
                  ...(debugMode ? { 
                    border: '5px solid #00ff00', 
                    background: 'rgba(0, 255, 0, 0.3)', 
                    position: 'relative'
                  } : {})
                }}
              >
                {invoiceForm.invoiceItems.length === 0 ? (
                  <>
                    <tr style={{ display: 'table-row', height: '304px' }}>
                      <td
                        colSpan={itemColumnOrder.filter(key => itemColumnVisibility[key]).length}
                        style={{
                          padding: '2rem',
                          textAlign: 'center',
                          color: '#666',
                          fontStyle: 'italic',
                          height: '304px',
                          verticalAlign: 'top',
                          ...(debugMode ? { 
                            border: '3px dashed yellow', 
                            background: 'rgba(255, 255, 0, 0.2)'
                          } : {})
                        }}
                      >
                        Məhsul yoxdur. ➕ düyməsinə basaraq yeni sətir əlavə edin.
                        {debugMode && (
                          <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#ff0000' }}>
                            DEBUG: Bu boş sətir mesajıdır (tbody içində)
                          </div>
                        )}
                      </td>
                    </tr>
                    {/* Boş sətirlər footer-in yuxarı qalxmasının qarşısını almaq üçün */}
                    {Array.from({ length: 10 }).map((_, emptyIndex) => (
                      <tr key={`empty-${emptyIndex}`} style={{ display: 'table-row', height: '40px' }}>
                        {itemColumnOrder.map((columnKey) => {
                          if (!itemColumnVisibility[columnKey]) return null
                          const width = itemColumnWidths[columnKey] || 100
                          return (
                            <td
                              key={`empty-${emptyIndex}-${columnKey}`}
                              style={{
                                padding: '0.75rem',
                                borderRight: '1px solid #e0e0e0',
                                borderBottom: '1px solid #eee',
                                width: `${width}px`,
                                minWidth: `${width}px`,
                                maxWidth: `${width}px`,
                                height: '40px',
                                background: 'white',
                              }}
                            />
                          )
                        })}
                      </tr>
                    ))}
                  </>
                ) : (
                  <>
                    {invoiceForm.invoiceItems.map((item, index) => {
                    const isSelected = selectedItemIndices.has(index)
                    const productInfo = getProductInfo(item.product_id)
                    
                    return (
                      <tr
                        key={index}
                        onClick={() => {
                          if (itemMultiSelectMode) {
                            const newSelected = new Set(selectedItemIndices)
                            if (isSelected) {
                              newSelected.delete(index)
                            } else {
                              newSelected.add(index)
                            }
                            setSelectedItemIndices(newSelected)
                          } else {
                            setSelectedItemIndices(new Set([index]))
                          }
                        }}
                        style={{
                          display: 'table-row',
                          background: isSelected ? '#e3f2fd' : 'white',
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee',
                          transition: 'background 0.2s',
                        }}
                      >
                        {itemColumnOrder.map((columnKey) => {
                          if (!itemColumnVisibility[columnKey]) return null
                          const config = itemColumnConfig[columnKey]
                          const isCheckbox = columnKey === 'checkbox'
                          const isRowNumber = columnKey === 'rowNumber'
                          const width = itemColumnWidths[columnKey] || 100

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
                                  setItemMultiSelectMode(true)
                                  const newSelected = new Set(selectedItemIndices)
                                  if (e.target.checked) {
                                    newSelected.add(index)
                                  } else {
                                    newSelected.delete(index)
                                  }
                                  setSelectedItemIndices(newSelected)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  cursor: 'pointer',
                                }}
                              />
                            )
                          } else if (isRowNumber) {
                            cellContent = index + 1
                          } else if (columnKey === 'product_name') {
                            cellStyle.fontWeight = isSelected ? 'bold' : 'normal'
                            cellStyle.position = 'relative'
                            cellStyle.padding = '0.25rem'
                            cellStyle.whiteSpace = 'normal'
                            cellStyle.zIndex = itemProductSearchFocused[index] ? 10001 : 'auto'
                            const searchText = itemProductSearch[index] !== undefined ? itemProductSearch[index] : (item.product_name || '')
                            const filtered = itemFilteredProducts[index] || []
                            const isFocused = itemProductSearchFocused[index] || false
                            
                            cellContent = (
                              <div style={{ position: 'relative', width: '100%', zIndex: isFocused ? 10001 : 1 }}>
                                <input
                                  ref={(el) => {
                                    if (el) {
                                      itemInputRefs.current.set(index, el)
                                    } else {
                                      itemInputRefs.current.delete(index)
                                    }
                                  }}
                                  type="text"
                                  value={searchText}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    handleItemProductSearch(index, e.target.value)
                                    setItemProductSearchFocused(prev => ({ ...prev, [index]: true }))
                                  }}
                                  onFocus={() => {
                                    setItemProductSearchFocused(prev => ({ ...prev, [index]: true }))
                                    if (itemProductSearch[index] === undefined) {
                                      setItemProductSearch(prev => ({ ...prev, [index]: item.product_name || '' }))
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const relatedTarget = (e.relatedTarget as HTMLElement) || document.activeElement
                                    if (relatedTarget && relatedTarget.closest('[data-product-dropdown]')) {
                                      return
                                    }
                                    setTimeout(() => {
                                      setItemProductSearchFocused(prev => ({ ...prev, [index]: false }))
                                      setItemFilteredProducts(prev => ({ ...prev, [index]: [] }))
                                    }, 200)
                                  }}
                                  placeholder="Məhsul adı..."
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    width: '100%',
                                    padding: '0.5rem',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    fontSize: '0.85rem',
                                  }}
                                />
                                {isFocused && filtered.length > 0 && createPortal(
                                  <>
                                    {/* Backdrop */}
                                    <div
                                      style={{
                                        position: 'fixed',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        zIndex: 10001,
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setItemProductSearchFocused(prev => ({ ...prev, [index]: false }))
                                        setItemFilteredProducts(prev => ({ ...prev, [index]: [] }))
                                      }}
                                    />
                                    {/* Dropdown Modal */}
                                    <div
                                      data-product-dropdown
                                      style={{
                                        position: 'fixed',
                                        background: 'white',
                                        border: '1px solid #ddd',
                                        borderRadius: '8px',
                                        maxHeight: '50vh',
                                        width: '90%',
                                        maxWidth: '500px',
                                        overflowY: 'auto',
                                        zIndex: 10002,
                                        boxShadow: '0 8px 16px rgba(0,0,0,0.3)',
                                        padding: '0.5rem',
                                      }}
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={(e) => e.stopPropagation()}
                                      ref={(el) => {
                                        if (el) {
                                          const input = itemInputRefs.current.get(index)
                                          if (input) {
                                            const rect = input.getBoundingClientRect()
                                            const viewportHeight = window.innerHeight
                                            const modalHeight = Math.min(400, viewportHeight * 0.5)
                                            const spaceBelow = viewportHeight - rect.bottom
                                            const spaceAbove = rect.top
                                            
                                            // Əgər aşağıda kifayət qədər yer varsa, aşağıda aç
                                            if (spaceBelow >= modalHeight + 10) {
                                              el.style.top = `${rect.bottom + 5}px`
                                              el.style.left = `${Math.max(10, rect.left)}px`
                                              el.style.width = `${Math.min(rect.width, window.innerWidth - 20)}px`
                                            } 
                                            // Əgər yuxarıda daha çox yer varsa, yuxarıda aç
                                            else if (spaceAbove > spaceBelow) {
                                              el.style.bottom = `${viewportHeight - rect.top + 5}px`
                                              el.style.left = `${Math.max(10, rect.left)}px`
                                              el.style.width = `${Math.min(rect.width, window.innerWidth - 20)}px`
                                            }
                                            // Əks halda, aşağıda aç amma maksimum yüksəklik məhdudlaşdır
                                            else {
                                              el.style.top = `${rect.bottom + 5}px`
                                              el.style.left = `${Math.max(10, rect.left)}px`
                                              el.style.width = `${Math.min(rect.width, window.innerWidth - 20)}px`
                                              el.style.maxHeight = `${spaceBelow - 10}px`
                                            }
                                          }
                                        }
                                      }}
                                    >
                                      <div style={{ 
                                        padding: '0.75rem', 
                                        borderBottom: '1px solid #eee', 
                                        marginBottom: '0.5rem',
                                        fontWeight: 'bold',
                                        fontSize: '1rem',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                      }}>
                                        <span>Məhsul seçin ({filtered.length})</span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setItemProductSearchFocused(prev => ({ ...prev, [index]: false }))
                                            setItemFilteredProducts(prev => ({ ...prev, [index]: [] }))
                                          }}
                                          style={{
                                            background: 'transparent',
                                            border: 'none',
                                            fontSize: '1.5rem',
                                            cursor: 'pointer',
                                            padding: '0 0.5rem',
                                            color: '#666',
                                          }}
                                        >
                                          ×
                                        </button>
                                      </div>
                                      <div style={{ maxHeight: 'calc(50vh - 80px)', overflowY: 'auto' }}>
                                        {filtered.map((product) => (
                                          <div
                                            key={product.id}
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleSelectItemProduct(index, product)
                                              setItemProductSearchFocused(prev => ({ ...prev, [index]: false }))
                                              setItemFilteredProducts(prev => ({ ...prev, [index]: [] }))
                                            }}
                                            style={{
                                              padding: '0.75rem',
                                              cursor: 'pointer',
                                              borderBottom: '1px solid #f0f0f0',
                                              background: item.product_id === product.id ? '#e7f3ff' : 'white',
                                              borderRadius: '4px',
                                              marginBottom: '0.25rem',
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.background = '#f5f5f5'
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.background = item.product_id === product.id ? '#e7f3ff' : 'white'
                                            }}
                                          >
                                            <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '0.25rem' }}>{product.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#666', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                              {product.code && (
                                                <span>Kod: {product.code}</span>
                                              )}
                                              {product.article && (
                                                <span>Artikul: {product.article}</span>
                                              )}
                                              {product.barcode && (
                                                <span>Barkod: {product.barcode}</span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </>,
                                  document.body
                                )}
                              </div>
                            )
                          } else if (columnKey === 'code') {
                            cellContent = productInfo?.code || '-'
                          } else if (columnKey === 'unit') {
                            cellContent = productInfo?.unit || '-'
                          } else if (columnKey === 'quantity') {
                            const inputKey = `quantity-${index}`
                            const isFocused = focusedInputs[inputKey] || false
                            const displayValue = isFocused && item.quantity === 0 ? '' : item.quantity
                            cellContent = (
                              <input
                                type="number"
                                value={displayValue}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleUpdateItem(index, 'quantity', Number(e.target.value) || 0)
                                }}
                                onFocus={(e) => {
                                  e.stopPropagation()
                                  setFocusedInputs(prev => ({ ...prev, [inputKey]: true }))
                                  if (item.quantity === 0) {
                                    e.target.select()
                                  }
                                }}
                                onBlur={(e) => {
                                  e.stopPropagation()
                                  setFocusedInputs(prev => ({ ...prev, [inputKey]: false }))
                                  if (!e.target.value || e.target.value === '') {
                                    handleUpdateItem(index, 'quantity', 0)
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                min="0"
                                step="0.01"
                                style={{
                                  width: '100%',
                                  padding: '0.25rem',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '0.85rem',
                                  textAlign: 'right',
                                }}
                              />
                            )
                          } else if (columnKey === 'barcode') {
                            cellContent = productInfo?.barcode || '-'
                          } else if (columnKey === 'unit_price') {
                            const inputKey = `unit_price-${index}`
                            const isFocused = focusedInputs[inputKey] || false
                            const displayValue = isFocused && item.unit_price === 0 ? '' : item.unit_price
                            cellContent = (
                              <input
                                type="number"
                                value={displayValue}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleUpdateItem(index, 'unit_price', Number(e.target.value) || 0)
                                }}
                                onFocus={(e) => {
                                  e.stopPropagation()
                                  setFocusedInputs(prev => ({ ...prev, [inputKey]: true }))
                                  if (item.unit_price === 0) {
                                    e.target.select()
                                  }
                                }}
                                onBlur={(e) => {
                                  e.stopPropagation()
                                  setFocusedInputs(prev => ({ ...prev, [inputKey]: false }))
                                  if (!e.target.value || e.target.value === '') {
                                    handleUpdateItem(index, 'unit_price', 0)
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                min="0"
                                step="0.01"
                                style={{
                                  width: '100%',
                                  padding: '0.25rem',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '0.85rem',
                                  textAlign: 'right',
                                }}
                              />
                            )
                          } else if (columnKey === 'total_price') {
                            cellStyle.fontWeight = 'bold'
                            cellStyle.color = '#28a745'
                            cellContent = `${item.total_price.toFixed(2)} ₼`
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
                    {/* Boş sətirlər footer-in yuxarı qalxmasının qarşısını almaq üçün */}
                    {Array.from({ length: Math.max(0, 10 - invoiceForm.invoiceItems.length) }).map((_, emptyIndex) => (
                      <tr key={`empty-${emptyIndex}`} style={{ display: 'table-row', height: '40px' }}>
                        {itemColumnOrder.map((columnKey) => {
                          if (!itemColumnVisibility[columnKey]) return null
                          const width = itemColumnWidths[columnKey] || 100
                          return (
                            <td
                              key={`empty-${emptyIndex}-${columnKey}`}
                              style={{
                                padding: '0.75rem',
                                borderRight: '1px solid #e0e0e0',
                                borderBottom: '1px solid #eee',
                                width: `${width}px`,
                                minWidth: `${width}px`,
                                maxWidth: `${width}px`,
                                height: '40px',
                                background: 'white',
                              }}
                            />
                          )
                        })}
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
            {/* Footer */}
            {(() => {
              // Yalnız görünən sütunları filtrlə
              const visibleColumns = itemColumnOrder.filter(key => itemColumnVisibility[key])
              
              // Table-in ümumi genişliyini hesabla
              const totalTableWidth = visibleColumns
                .reduce((sum, key) => sum + (itemColumnWidths[key] || 100), 0)
              
              return (
                <div
                  style={{
                    background: '#f5f5f5',
                    borderTop: '2px solid #ddd',
                    display: 'flex',
                    width: `${totalTableWidth}px`,
                    minWidth: `${totalTableWidth}px`,
                    maxWidth: `${totalTableWidth}px`,
                    flexShrink: 0,
                    ...(debugMode ? { border: '2px solid magenta', background: 'rgba(255, 0, 255, 0.1)' } : {})
                  }}
                >
                  {visibleColumns.map((columnKey) => {
                    const config = itemColumnConfig[columnKey]
                    const width = itemColumnWidths[columnKey] || 100

                    const cellStyle: React.CSSProperties = {
                      padding: '0.5rem',
                      borderRight: '1px solid #e0e0e0',
                      textAlign: config?.align || 'left',
                      fontSize: '0.85rem',
                      background: '#f5f5f5',
                      fontWeight: 'bold',
                      width: `${width}px`,
                      minWidth: `${width}px`,
                      maxWidth: `${width}px`,
                      flexShrink: 0,
                    }

                    let content: React.ReactNode = ''

                    if (columnKey === 'product_name') {
                      // "Ümumi:" sözünü silirik
                      content = ''
                      cellStyle.textAlign = 'left'
                    } else if (columnKey === 'quantity') {
                      // Miqdar cəmi
                      const totalQuantity = invoiceForm.invoiceItems.reduce((sum, item) => sum + (item.quantity || 0), 0)
                      cellStyle.textAlign = 'right'
                      content = totalQuantity.toFixed(2)
                      cellStyle.color = '#333'
                    } else if (columnKey === 'total_price') {
                      cellStyle.textAlign = 'right'
                      content = `${totalAmount.toFixed(2)} ₼`
                      cellStyle.color = '#28a745'
                    }

                    return (
                      <div key={`footer-${columnKey}`} style={cellStyle}>
                        {content}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
            </div>
          </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ 
          display: 'flex', 
          gap: '0.5rem', 
          marginTop: '1rem',
          padding: '1rem 0',
          borderTop: '1px solid #e0e0e0',
        }}>
          <button
            onClick={handleSaveInvoice}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
            }}
          >
            Yadda saxla
          </button>
          <button
            onClick={handleSaveAndConfirm}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

