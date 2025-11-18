import React, { useState } from 'react'

export interface ColumnConfig {
  id: string
  label: string
  visible: boolean
  width: number
  order: number
}

export interface FunctionSettings {
  multiSelect?: boolean
  ctrlClickMultiSelect?: boolean
  deleteEnabled?: boolean
  enableColumnDrag?: boolean
  [key: string]: any
}

export interface TableSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  columns: ColumnConfig[]
  onColumnsChange: (columns: ColumnConfig[]) => void
  defaultColumns: ColumnConfig[]
  functionSettings?: FunctionSettings
  onFunctionSettingsChange?: (settings: FunctionSettings) => void
  showFunctionsTab?: boolean
  customFunctionContent?: React.ReactNode
}

export default function TableSettingsModal({
  isOpen,
  onClose,
  title = 'Cədvəl Ayarları',
  columns,
  onColumnsChange,
  defaultColumns,
  functionSettings,
  onFunctionSettingsChange,
  showFunctionsTab = true,
  customFunctionContent
}: TableSettingsModalProps) {
  const [settingsTab, setSettingsTab] = useState<'columns' | 'functions'>('columns')

  if (!isOpen) return null

  const sortedColumns = [...columns].sort((a, b) => a.order - b.order)

  const toggleColumnVisibility = (columnId: string) => {
    const updatedColumns = columns.map(col =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    )
    onColumnsChange(updatedColumns)
  }

  const updateColumnWidth = (columnId: string, width: number) => {
    const updatedColumns = columns.map(col =>
      col.id === columnId ? { ...col, width: Math.max(50, Math.min(500, width)) } : col
    )
    onColumnsChange(updatedColumns)
  }

  const moveColumn = (columnId: string, direction: 'up' | 'down') => {
    const updatedColumns = [...columns]
    const currentIndex = updatedColumns.findIndex(col => col.id === columnId)
    
    if (currentIndex === -1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= updatedColumns.length) return

    const currentOrder = updatedColumns[currentIndex].order
    const targetOrder = updatedColumns[targetIndex].order

    updatedColumns[currentIndex].order = targetOrder
    updatedColumns[targetIndex].order = currentOrder

    onColumnsChange(updatedColumns)
  }

  const resetColumns = () => {
    onColumnsChange(defaultColumns.map(col => ({ ...col })))
  }

  const updateFunctionSettings = (key: string, value: any) => {
    if (onFunctionSettingsChange && functionSettings) {
      onFunctionSettingsChange({ ...functionSettings, [key]: value })
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '0',
          maxWidth: '700px',
          width: '90%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          padding: '1.5rem 1.5rem 0 1.5rem', 
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#333' }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#666',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f0f0f0'
              e.currentTarget.style.color = '#333'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#666'
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid #e0e0e0',
          padding: '0 1.5rem',
          gap: '0.5rem'
        }}>
          <button
            onClick={() => setSettingsTab('columns')}
            style={{
              padding: '0.75rem 1rem',
              background: settingsTab === 'columns' ? '#007bff' : 'transparent',
              color: settingsTab === 'columns' ? 'white' : '#666',
              border: 'none',
              borderBottom: settingsTab === 'columns' ? '3px solid #0056b3' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: settingsTab === 'columns' ? '600' : '400',
              transition: 'all 0.2s',
            }}
          >
            Sütunlar
          </button>
          {showFunctionsTab && (
            <button
              onClick={() => setSettingsTab('functions')}
              style={{
                padding: '0.75rem 1rem',
                background: settingsTab === 'functions' ? '#007bff' : 'transparent',
                color: settingsTab === 'functions' ? 'white' : '#666',
                border: 'none',
                borderBottom: settingsTab === 'functions' ? '3px solid #0056b3' : '3px solid transparent',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: settingsTab === 'functions' ? '600' : '400',
                transition: 'all 0.2s',
              }}
            >
              Funksiyalar
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ 
          padding: '1.5rem', 
          overflow: 'auto', 
          flex: 1,
          minHeight: 0
        }}>
          {settingsTab === 'columns' ? (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <button
                  onClick={resetColumns}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  🔄 Varsayılanlara qaytar
                </button>
              </div>

              <div style={{ border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Sütun</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Göstər</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Genişlik</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Yer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedColumns.filter(col => col.id !== 'checkbox').map((column, index) => (
                      <tr key={column.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                        <td style={{ padding: '0.75rem', fontWeight: '500' }}>{column.label}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={column.visible}
                            onChange={() => toggleColumnVisibility(column.id)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <input
                            type="number"
                            value={column.width}
                            onChange={(e) => updateColumnWidth(column.id, parseInt(e.target.value) || 50)}
                            min={50}
                            max={500}
                            style={{
                              width: '80px',
                              padding: '0.25rem',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              textAlign: 'center'
                            }}
                          />
                          <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.9rem' }}>px</span>
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                          <button
                            onClick={() => moveColumn(column.id, 'up')}
                            disabled={index === 0}
                            style={{
                              background: index === 0 ? '#ccc' : '#007bff',
                              color: 'white',
                              border: 'none',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              cursor: index === 0 ? 'not-allowed' : 'pointer',
                              marginRight: '0.25rem',
                              fontSize: '0.85rem'
                            }}
                            title="Yuxarı"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveColumn(column.id, 'down')}
                            disabled={index === sortedColumns.filter(col => col.id !== 'checkbox').length - 1}
                            style={{
                              background: index === sortedColumns.filter(col => col.id !== 'checkbox').length - 1 ? '#ccc' : '#007bff',
                              color: 'white',
                              border: 'none',
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              cursor: index === sortedColumns.filter(col => col.id !== 'checkbox').length - 1 ? 'not-allowed' : 'pointer',
                              fontSize: '0.85rem'
                            }}
                            title="Aşağı"
                          >
                            ↓
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div>
              {customFunctionContent || (
                functionSettings && onFunctionSettingsChange ? (
                  <div>
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ marginBottom: '1rem', color: '#333', fontSize: '1rem', fontWeight: '600' }}>Seçim Funksiyaları</h3>
                      
                      {functionSettings.multiSelect !== undefined && (
                        <div style={{ 
                          padding: '1rem', 
                          background: '#f8f9fa', 
                          borderRadius: '8px',
                          marginBottom: '1rem'
                        }}>
                          <label style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.75rem',
                            cursor: 'pointer',
                            marginBottom: '1rem'
                          }}>
                            <input
                              type="checkbox"
                              checked={functionSettings.multiSelect}
                              onChange={(e) => updateFunctionSettings('multiSelect', e.target.checked)}
                              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                            />
                            <div>
                              <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                Çoxlu seçim aktivdir
                              </div>
                              <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                Birdən çox element seçməyə imkan verir
                              </div>
                            </div>
                          </label>

                          {functionSettings.ctrlClickMultiSelect !== undefined && (
                            <label style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.75rem',
                              cursor: 'pointer',
                              marginBottom: '1rem'
                            }}>
                              <input
                                type="checkbox"
                                checked={functionSettings.ctrlClickMultiSelect}
                                onChange={(e) => updateFunctionSettings('ctrlClickMultiSelect', e.target.checked)}
                                disabled={!functionSettings.multiSelect}
                                style={{ 
                                  width: '20px', 
                                  height: '20px', 
                                  cursor: functionSettings.multiSelect ? 'pointer' : 'not-allowed',
                                  opacity: functionSettings.multiSelect ? 1 : 0.5
                                }}
                              />
                              <div>
                                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                  Ctrl basaraq çoxlu seçim
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                  Aktivdirsə, yalnız Ctrl basaraq birdən çox element seçilə bilər. Passivdirsə, normal kliklə çoxlu seçim mümkündür.
                                </div>
                              </div>
                            </label>
                          )}

                          {functionSettings.deleteEnabled !== undefined && (
                            <label style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.75rem',
                              cursor: 'pointer'
                            }}>
                              <input
                                type="checkbox"
                                checked={functionSettings.deleteEnabled}
                                onChange={(e) => updateFunctionSettings('deleteEnabled', e.target.checked)}
                                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                              />
                              <div>
                                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                  Delete düyməsi ilə silmə
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                  Aktivdirsə, Delete düyməsinə basaraq seçilmiş elementləri silmək mümkündür
                                </div>
                              </div>
                            </label>
                          )}

                          {functionSettings.enableColumnDrag !== undefined && (
                            <label style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '0.75rem',
                              cursor: 'pointer',
                              marginTop: '1rem'
                            }}>
                              <input
                                type="checkbox"
                                checked={functionSettings.enableColumnDrag}
                                onChange={(e) => updateFunctionSettings('enableColumnDrag', e.target.checked)}
                                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                              />
                              <div>
                                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                  Sütun sürüşdürmə
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                  Sütunları sürüşdürərək yerini dəyişdirməyə imkan verir
                                </div>
                              </div>
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ 
          padding: '1rem 1.5rem', 
          borderTop: '1px solid #e0e0e0',
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '0.5rem' 
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1.5rem',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '500',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#0056b3'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#007bff'
            }}
          >
            Bağla
          </button>
        </div>
      </div>
    </div>
  )
}

