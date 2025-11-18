import { useState } from 'react'

export interface FilterColumn {
  id: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'folder'
  options?: Array<{ id: number | string, label: string }> // Select və multiselect üçün
}

export interface FilterValue {
  columnId: string
  type: 'single' | 'multiple' | 'folder'
  value: any // Tək dəyər
  values?: any[] // Çoxlu dəyərlər
  folderIds?: number[] // Papka ID-ləri
}

export interface FilterModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  columns: FilterColumn[]
  onApply: (filters: FilterValue[]) => void
  onClear?: () => void
  // Məlumat mənbələri (müştərilər, papkalar və s.)
  customers?: Array<{ id: number, name: string }>
  suppliers?: Array<{ id: number, name: string }>
  folders?: Array<{ id: number, name: string }> // Anbar papkaları
}

export default function FilterModal({
  isOpen,
  onClose,
  title = 'Filtr',
  columns,
  onApply,
  onClear,
  customers = [],
  suppliers = [],
  folders = []
}: FilterModalProps) {
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterValue[]>([])
  const [showMultiSelectModal, setShowMultiSelectModal] = useState(false)
  const [currentFilterIndex, setCurrentFilterIndex] = useState<number | null>(null)

  if (!isOpen) return null

  const handleAddFilter = () => {
    if (!selectedColumn) return
    
    const newFilter: FilterValue = {
      columnId: selectedColumn,
      type: 'single',
      value: ''
    }
    setFilters([...filters, newFilter])
    setSelectedColumn(null)
  }

  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index))
  }

  const handleFilterTypeChange = (index: number, type: 'single' | 'multiple' | 'folder') => {
    const updatedFilters = [...filters]
    updatedFilters[index] = {
      ...updatedFilters[index],
      type,
      value: type === 'single' ? '' : undefined,
      values: type === 'multiple' ? [] : undefined,
      folderIds: type === 'folder' ? [] : undefined
    }
    setFilters(updatedFilters)
  }

  const handleFilterValueChange = (index: number, value: any) => {
    const updatedFilters = [...filters]
    updatedFilters[index] = {
      ...updatedFilters[index],
      value
    }
    setFilters(updatedFilters)
  }

  const handleOpenMultiSelect = (index: number) => {
    setCurrentFilterIndex(index)
    setShowMultiSelectModal(true)
  }

  const handleMultiSelectApply = (selectedItems: any[]) => {
    if (currentFilterIndex !== null) {
      const updatedFilters = [...filters]
      updatedFilters[currentFilterIndex] = {
        ...updatedFilters[currentFilterIndex],
        values: selectedItems
      }
      setFilters(updatedFilters)
    }
    setShowMultiSelectModal(false)
    setCurrentFilterIndex(null)
  }

  const getFilterOptions = (columnId: string): Array<{ id: number | string, label: string }> => {
    if (columnId === 'customer_id' || columnId === 'supplier_id') {
      const items = columnId === 'customer_id' ? customers : suppliers
      // customers və suppliers { id: number, name: string }[] formatındadır
      // Biz onları { id: number, label: string }[] formatına çeviririk
      return items.map(item => ({ id: item.id, label: item.name }))
    }
    const column = columns.find(c => c.id === columnId)
    return column?.options || []
  }

  const getFilterDisplayValue = (filter: FilterValue) => {
    if (filter.type === 'single') {
      if (filter.columnId === 'customer_id' || filter.columnId === 'supplier_id') {
        const items = filter.columnId === 'customer_id' ? customers : suppliers
        const item = items.find(i => i.id === filter.value)
        return item?.name || ''
      }
      return filter.value || ''
    } else if (filter.type === 'multiple') {
      if (filter.values && filter.values.length > 0) {
        return `${filter.values.length} seçim`
      }
      return ''
    } else if (filter.type === 'folder') {
      if (filter.folderIds && filter.folderIds.length > 0) {
        return `${filter.folderIds.length} papka`
      }
      return ''
    }
    return ''
  }

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            padding: '1.5rem',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{title}</h2>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem'
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', minHeight: '400px' }}>
            {/* Sol bölmə - Sütun seçimi */}
            <div style={{ flex: '0 0 200px', borderRight: '1px solid #ddd', paddingRight: '1rem' }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem', marginBottom: '0.5rem' }}>Sütunlar</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {columns.map(column => (
                  <button
                    key={column.id}
                    onClick={() => setSelectedColumn(column.id)}
                    style={{
                      padding: '0.5rem',
                      background: selectedColumn === column.id ? '#e7f3ff' : 'transparent',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '0.875rem'
                    }}
                  >
                    {column.label}
                  </button>
                ))}
              </div>
              {selectedColumn && (
                <button
                  onClick={handleAddFilter}
                  style={{
                    marginTop: '1rem',
                    padding: '0.5rem 1rem',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  Əlavə et
                </button>
              )}
            </div>

            {/* Sağ bölmə - Filtr dəyərləri */}
            <div style={{ flex: 1 }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem', marginBottom: '0.5rem' }}>Filtrlər</h3>
              {filters.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                  Filtr yoxdur. Sol tərəfdən sütun seçin və "Əlavə et" düyməsinə basın.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filters.map((filter, index) => {
                    const column = columns.find(c => c.id === filter.columnId)
                    if (!column) return null

                    return (
                      <div
                        key={index}
                        style={{
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          padding: '0.75rem',
                          display: 'flex',
                          gap: '0.5rem',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: '0 0 150px', fontWeight: 'bold' }}>{column.label}</div>
                        
                        {/* Tip seçimi */}
                        <select
                          value={filter.type}
                          onChange={(e) => handleFilterTypeChange(index, e.target.value as 'single' | 'multiple' | 'folder')}
                          style={{
                            padding: '0.25rem 0.5rem',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            fontSize: '0.875rem'
                          }}
                        >
                          <option value="single">1 seçim</option>
                          <option value="multiple">1-dən çox seçim</option>
                          {column.type === 'folder' && <option value="folder">Papka</option>}
                        </select>

                        {/* Dəyər input/select */}
                        {filter.type === 'single' && (
                          <div style={{ flex: 1, display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            {column.type === 'select' || column.id === 'customer_id' || column.id === 'supplier_id' ? (
                              <select
                                value={filter.value || ''}
                                onChange={(e) => handleFilterValueChange(index, e.target.value ? parseInt(e.target.value) : '')}
                                style={{
                                  flex: 1,
                                  padding: '0.25rem 0.5rem',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '0.875rem'
                                }}
                              >
                                <option value="">Seçin...</option>
                                {getFilterOptions(filter.columnId).map(option => (
                                  <option key={option.id} value={option.id}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
                                value={filter.value || ''}
                                onChange={(e) => handleFilterValueChange(index, e.target.value)}
                                placeholder="Dəyər daxil edin..."
                                style={{
                                  flex: 1,
                                  padding: '0.25rem 0.5rem',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '0.875rem'
                                }}
                              />
                            )}
                          </div>
                        )}

                        {filter.type === 'multiple' && (
                          <div style={{ flex: 1, display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={getFilterDisplayValue(filter)}
                              readOnly
                              placeholder="Seçimlər..."
                              style={{
                                flex: 1,
                                padding: '0.25rem 0.5rem',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '0.875rem',
                                background: '#f5f5f5'
                              }}
                            />
                            <button
                              onClick={() => handleOpenMultiSelect(index)}
                              style={{
                                padding: '0.25rem 0.75rem',
                                background: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.875rem'
                              }}
                            >
                              Seç
                            </button>
                          </div>
                        )}

                        {filter.type === 'folder' && (
                          <div style={{ flex: 1, display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={getFilterDisplayValue(filter)}
                              readOnly
                              placeholder="Papkalar..."
                              style={{
                                flex: 1,
                                padding: '0.25rem 0.5rem',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                fontSize: '0.875rem',
                                background: '#f5f5f5'
                              }}
                            />
                            <button
                              onClick={() => {
                                // Papka seçimi üçün modal aç
                                setCurrentFilterIndex(index)
                                setShowMultiSelectModal(true)
                              }}
                              style={{
                                padding: '0.25rem 0.75rem',
                                background: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.875rem'
                              }}
                            >
                              Papka
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => handleRemoveFilter(index)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                          }}
                        >
                          Sil
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Düymələr */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #ddd' }}>
            {onClear && (
              <button
                onClick={() => {
                  setFilters([])
                  onClear()
                }}
                style={{
                  padding: '0.5rem 1.5rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Təmizlə
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Bağla
            </button>
            <button
              onClick={() => {
                onApply(filters)
                onClose()
              }}
              style={{
                padding: '0.5rem 1.5rem',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Tətbiq et
            </button>
          </div>
        </div>
      </div>

      {/* Çoxlu seçim modalı */}
      {showMultiSelectModal && currentFilterIndex !== null && (
        <MultiSelectModal
          isOpen={showMultiSelectModal}
          onClose={() => {
            setShowMultiSelectModal(false)
            setCurrentFilterIndex(null)
          }}
          title={filters[currentFilterIndex]?.type === 'folder' ? 'Papka seçin' : 'Seçimlər'}
          items={
            filters[currentFilterIndex]?.type === 'folder'
              ? folders.map(f => ({ id: f.id, label: f.name }))
              : getFilterOptions(filters[currentFilterIndex]?.columnId || '')
          }
          selectedItems={
            filters[currentFilterIndex]?.type === 'folder'
              ? filters[currentFilterIndex]?.folderIds || []
              : filters[currentFilterIndex]?.values || []
          }
          onApply={handleMultiSelectApply}
        />
      )}
    </>
  )
}

// Çoxlu seçim modalı
interface MultiSelectModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  items: Array<{ id: number | string, label: string }>
  selectedItems: any[]
  onApply: (selected: any[]) => void
}

function MultiSelectModal({ isOpen, onClose, title, items, selectedItems, onApply }: MultiSelectModalProps) {
  const [selected, setSelected] = useState<Set<any>>(new Set(selectedItems))

  if (!isOpen) return null

  const handleToggle = (id: any) => {
    const newSelected = new Set(selected)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelected(newSelected)
  }

  const handleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(items.map(item => item.id)))
    }
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
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          width: '90%',
          maxWidth: '500px',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={handleSelectAll}
            style={{
              padding: '0.5rem 1rem',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            {selected.size === items.length ? 'Hamısını ləğv et' : 'Hamısını seç'}
          </button>
        </div>

        <div style={{ maxHeight: '400px', overflow: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
          {items.map(item => (
            <div
              key={item.id}
              onClick={() => handleToggle(item.id)}
              style={{
                padding: '0.75rem',
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                background: selected.has(item.id) ? '#e7f3ff' : 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => handleToggle(item.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #ddd' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1.5rem',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Ləğv et
          </button>
          <button
            onClick={() => onApply(Array.from(selected))}
            style={{
              padding: '0.5rem 1.5rem',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Tətbiq et ({selected.size})
          </button>
        </div>
      </div>
    </div>
  )
}

