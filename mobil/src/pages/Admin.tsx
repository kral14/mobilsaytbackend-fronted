import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { logsAPI, usersAPI } from '../services/api'

interface Log {
  id: number
  user_id: number | null
  action_type: string
  entity_type: string
  entity_id: number | null
  description: string
  details: any
  created_at: string
  users: {
    id: number
    email: string
  } | null
}

interface User {
  id: number
  email: string
  role: string | null
  created_at: string | null
  updated_at: string | null
}

export default function Admin() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'logs' | 'users' | 'logFiles'>('logs')
  const [logs, setLogs] = useState<Log[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [logFiles, setLogFiles] = useState<Array<{
    userId: number
    fileName: string
    filePath: string
    size: number
    createdAt: Date
    modifiedAt: Date
    userEmail: string
    userFullName: string
  }>>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState({
    action_type: '',
    entity_type: '',
    start_date: '',
    end_date: '',
    user_id: '',
    entity_id: '',
  })
  const [invoiceNumbers, setInvoiceNumbers] = useState<Array<{ id: number; invoice_number: string }>>([])
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState({
    email: '',
    password: '',
    role: 'user',
  })

  const loadLogs = async () => {
    setLoading(true)
    try {
      const params: any = {
        page,
        limit: 50,
        ...filters,
      }
      // Boş string-ləri sil
      Object.keys(params).forEach(key => {
        if (params[key] === '') {
          delete params[key]
        }
      })
      const response = await logsAPI.getAll(params)
      setLogs(response.logs)
      setTotalPages(response.pagination.totalPages)
    } catch (err: any) {
      console.error('Loglar yüklənərkən xəta:', err)
      alert(err.response?.data?.message || 'Loglar yüklənə bilmədi')
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      const data = await usersAPI.getAll()
      console.log('✅ İstifadəçilər yükləndi:', data.length, 'istifadəçi')
      setUsers(data)
    } catch (err: any) {
      console.error('❌ İstifadəçilər yüklənərkən xəta:', err)
      alert(err.response?.data?.message || 'İstifadəçilər yüklənə bilmədi')
    }
  }

  const loadLogFiles = async () => {
    setLoading(true)
    try {
      const response = await logsAPI.getAllLogFiles()
      setLogFiles(response.logFiles)
    } catch (err: any) {
      console.error('Log faylları yüklənərkən xəta:', err)
      alert(err.response?.data?.message || 'Log faylları yüklənə bilmədi')
    } finally {
      setLoading(false)
    }
  }

  // Qaimə nömrələrini yüklə (entity type-a görə)
  const loadInvoiceNumbers = async (entityType: string) => {
    if (!entityType || (entityType !== 'purchase_invoice' && entityType !== 'sale_invoice')) {
      setInvoiceNumbers([])
      return
    }
    try {
      const response = await logsAPI.getInvoiceNumbers(entityType)
      setInvoiceNumbers(response.invoices)
    } catch (err: any) {
      console.error('Qaimə nömrələri yüklənərkən xəta:', err)
      setInvoiceNumbers([])
    }
  }

  // İstifadəçiləri komponent yüklənəndə yüklə (filter üçün lazımdır)
  useEffect(() => {
    loadUsers()
  }, [])

  // Entity type dəyişdikdə qaimə nömrələrini yüklə
  useEffect(() => {
    if (filters.entity_type) {
      loadInvoiceNumbers(filters.entity_type)
      // Entity type dəyişdikdə entity_id-ni təmizlə
      setFilters(prev => ({ ...prev, entity_id: '' }))
    } else {
      setInvoiceNumbers([])
      setFilters(prev => ({ ...prev, entity_id: '' }))
    }
  }, [filters.entity_type])

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs()
    } else if (activeTab === 'logFiles') {
      loadLogFiles()
    }
  }, [activeTab, page, filters])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('az-AZ', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const getActionTypeLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      invoice_created: 'Qaimə yaradıldı',
      invoice_confirmed: 'Qaimə təsdiqləndi',
      invoice_deleted: 'Qaimə silindi',
      invoice_restored: 'Qaimə geri qaytarıldı',
      warehouse_confirmed: 'Anbar qalığı təsdiqləndi',
      warehouse_unconfirmed: 'Anbar qalığı təsdiqsiz edildi',
      warehouse_deleted: 'Anbar qalığı silindi',
      warehouse_restored: 'Anbar qalığı geri qaytarıldı',
      supplier_balance_changed: 'Təchizatçı balansı dəyişdi',
      supplier_balance_invoice_confirmed: 'Təchizatçı balansı - Qaimə təsdiqləndi',
      supplier_balance_invoice_unconfirmed: 'Təchizatçı balansı - Qaimə təsdiqsiz edildi',
      supplier_balance_invoice_deleted: 'Təchizatçı balansı - Qaimə silindi',
      supplier_balance_payment_made: 'Təchizatçı balansı - Ödəniş edildi',
      supplier_balance_payment_deleted: 'Təchizatçı balansı - Ödəniş silindi',
      customer_balance_changed: 'Müştəri balansı dəyişdi',
      customer_balance_invoice_confirmed: 'Müştəri balansı - Qaimə təsdiqləndi',
      customer_balance_invoice_unconfirmed: 'Müştəri balansı - Qaimə təsdiqsiz edildi',
      customer_balance_invoice_deleted: 'Müştəri balansı - Qaimə silindi',
      customer_balance_payment_received: 'Müştəri balansı - Ödəniş alındı',
      customer_balance_payment_deleted: 'Müştəri balansı - Ödəniş silindi',
      error: 'Xəta',
    }
    return labels[actionType] || actionType
  }

  const getEntityTypeLabel = (entityType: string) => {
    const labels: Record<string, string> = {
      purchase_invoice: 'Alış qaiməsi',
      sale_invoice: 'Satış qaiməsi',
      warehouse: 'Anbar',
      supplier: 'Təchizatçı',
      customer: 'Müştəri',
      system: 'Sistem',
    }
    return labels[entityType] || entityType
  }

  const handleNewUser = () => {
    setEditingUser(null)
    setUserForm({ email: '', password: '', role: 'user' })
    setShowUserModal(true)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setUserForm({ email: user.email, password: '', role: user.role || 'user' })
    setShowUserModal(true)
  }

  const handleSaveUser = async () => {
    try {
      if (editingUser) {
        await usersAPI.update(editingUser.id.toString(), userForm)
      } else {
        await usersAPI.create(userForm)
      }
      setShowUserModal(false)
      loadUsers()
    } catch (err: any) {
      alert(err.response?.data?.message || 'İstifadəçi yadda saxlanıla bilmədi')
    }
  }

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Bu istifadəçini silmək istədiyinizə əminsiniz?')) {
      return
    }
    try {
      await usersAPI.delete(id.toString())
      loadUsers()
    } catch (err: any) {
      alert(err.response?.data?.message || 'İstifadəçi silinə bilmədi')
    }
  }

  const handleDownloadLogFile = async (userId: number) => {
    try {
      const blob = await logsAPI.downloadLogFile(userId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `user_${userId}_log.txt`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Log faylı yüklənə bilmədi')
    }
  }

  const handleDeleteLogFile = async (userId: number) => {
    if (!confirm('Bu log faylını silmək istədiyinizə əminsiniz? Bu həm faylı, həm də verilənlər bazasındakı logları siləcək.')) {
      return
    }
    try {
      await logsAPI.deleteLogFile(userId)
      loadLogFiles()
      alert('Log faylı silindi')
    } catch (err: any) {
      alert(err.response?.data?.message || 'Log faylı silinə bilmədi')
    }
  }

  const handleSyncLogFile = async (userId: number) => {
    try {
      await logsAPI.syncLogFile(userId)
      alert('Log faylı sinxronizasiya olundu')
      loadLogFiles()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Log faylı sinxronizasiya oluna bilmədi')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <Layout>
      <div style={{ 
        padding: '20px', 
        maxWidth: '1400px', 
        margin: '0 auto',
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '15px', 
          marginBottom: '20px', 
          flexShrink: 0,
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '10px 16px',
              backgroundColor: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#555'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#666'}
          >
            ← Geri
          </button>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '600' }}>Admin Paneli</h1>
        </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '5px', 
        marginBottom: '20px', 
        borderBottom: '2px solid #e0e0e0',
        flexShrink: 0,
        overflowX: 'auto',
      }}>
        <button
          onClick={() => setActiveTab('logs')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'logs' ? '#2196F3' : 'transparent',
            color: activeTab === 'logs' ? 'white' : '#666',
            border: 'none',
            borderBottom: activeTab === 'logs' ? '3px solid #2196F3' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'logs' ? '600' : '400',
            fontSize: '15px',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'logs') {
              e.currentTarget.style.backgroundColor = '#f5f5f5'
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'logs') {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
        >
          Aktivlik Logları
        </button>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'users' ? '#2196F3' : 'transparent',
            color: activeTab === 'users' ? 'white' : '#666',
            border: 'none',
            borderBottom: activeTab === 'users' ? '3px solid #2196F3' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'users' ? '600' : '400',
            fontSize: '15px',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'users') {
              e.currentTarget.style.backgroundColor = '#f5f5f5'
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'users') {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
        >
          İstifadəçilər
        </button>
        <button
          onClick={() => setActiveTab('logFiles')}
          style={{
            padding: '12px 24px',
            backgroundColor: activeTab === 'logFiles' ? '#2196F3' : 'transparent',
            color: activeTab === 'logFiles' ? 'white' : '#666',
            border: 'none',
            borderBottom: activeTab === 'logFiles' ? '3px solid #2196F3' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: activeTab === 'logFiles' ? '600' : '400',
            fontSize: '15px',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'logFiles') {
              e.currentTarget.style.backgroundColor = '#f5f5f5'
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'logFiles') {
              e.currentTarget.style.backgroundColor = 'transparent'
            }
          }}
        >
          Log Faylları
        </button>
      </div>

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <>
          {/* Filters */}
          <div style={{ 
            marginBottom: '20px', 
            display: 'flex', 
            gap: '12px', 
            flexWrap: 'wrap', 
            flexShrink: 0,
            padding: '16px',
            backgroundColor: '#f9f9f9',
            borderRadius: '8px',
            border: '1px solid #e0e0e0',
          }}>
            <select
              value={filters.user_id}
              onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
              style={{ 
                padding: '10px 12px', 
                borderRadius: '6px', 
                border: '1px solid #ddd', 
                minWidth: '220px',
                fontSize: '14px',
                backgroundColor: 'white',
                cursor: 'pointer',
              }}
            >
              <option value="">Bütün istifadəçilər</option>
              {users.length > 0 ? (
                users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.email}
                  </option>
                ))
              ) : (
                <option value="" disabled>Yüklənir...</option>
              )}
            </select>

            <select
              value={filters.action_type}
              onChange={(e) => setFilters({ ...filters, action_type: e.target.value })}
              style={{ 
                padding: '10px 12px', 
                borderRadius: '6px', 
                border: '1px solid #ddd',
                minWidth: '180px',
                fontSize: '14px',
                backgroundColor: 'white',
                cursor: 'pointer',
              }}
            >
              <option value="">Bütün əməliyyatlar</option>
              <option value="invoice_created">Qaimə yaradıldı</option>
              <option value="invoice_confirmed">Qaimə təsdiqləndi</option>
              <option value="invoice_deleted">Qaimə silindi</option>
              <option value="invoice_restored">Qaimə geri qaytarıldı</option>
              <option value="warehouse_confirmed">Anbar təsdiqləndi</option>
              <option value="warehouse_unconfirmed">Anbar təsdiqsiz edildi</option>
              <option value="warehouse_deleted">Anbar silindi</option>
              <option value="warehouse_restored">Anbar geri qaytarıldı</option>
              <option value="supplier_balance_changed">Təchizatçı balansı dəyişdi</option>
              <option value="customer_balance_changed">Müştəri balansı dəyişdi</option>
              <option value="error">Xəta</option>
            </select>

            <select
              value={filters.entity_type}
              onChange={(e) => setFilters({ ...filters, entity_type: e.target.value, entity_id: '' })}
              style={{ 
                padding: '10px 12px', 
                borderRadius: '6px', 
                border: '1px solid #ddd',
                minWidth: '160px',
                fontSize: '14px',
                backgroundColor: 'white',
                cursor: 'pointer',
              }}
            >
              <option value="">Bütün tiplər</option>
              <option value="purchase_invoice">Alış qaiməsi</option>
              <option value="sale_invoice">Satış qaiməsi</option>
              <option value="warehouse">Anbar</option>
              <option value="supplier">Təchizatçı</option>
              <option value="customer">Müştəri</option>
              <option value="system">Sistem</option>
            </select>

            {/* Qaimə nömrəsi filteri - yalnız purchase_invoice və ya sale_invoice seçildikdə görünür */}
            {(filters.entity_type === 'purchase_invoice' || filters.entity_type === 'sale_invoice') && (
              <select
                value={filters.entity_id}
                onChange={(e) => setFilters({ ...filters, entity_id: e.target.value })}
                style={{ 
                  padding: '10px 12px', 
                  borderRadius: '6px', 
                  border: '1px solid #ddd',
                  minWidth: '200px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                }}
              >
                <option value="">Bütün qaimələr</option>
                {invoiceNumbers.length > 0 ? (
                  invoiceNumbers.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>Yüklənir...</option>
                )}
              </select>
            )}

            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              placeholder="Başlanğıc tarix"
              style={{ 
                padding: '10px 12px', 
                borderRadius: '6px', 
                border: '1px solid #ddd',
                fontSize: '14px',
                backgroundColor: 'white',
                cursor: 'pointer',
              }}
            />

            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              placeholder="Son tarix"
              style={{ 
                padding: '10px 12px', 
                borderRadius: '6px', 
                border: '1px solid #ddd',
                fontSize: '14px',
                backgroundColor: 'white',
                cursor: 'pointer',
              }}
            />

            <button
              onClick={() => setFilters({ action_type: '', entity_type: '', start_date: '', end_date: '', user_id: '', entity_id: '' })}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d32f2f'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f44336'}
            >
              Filtrləri təmizlə
            </button>
          </div>

          {/* Logs Table */}
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Yüklənir...</div>
          ) : (
            <>
              <div style={{ 
                overflowX: 'auto', 
                overflowY: 'auto',
                flex: 1,
                minHeight: '400px',
                maxHeight: 'calc(100vh - 450px)',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                backgroundColor: 'white',
              }}>
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse',
                  fontSize: '14px',
                }}>
                  <thead style={{ 
                    position: 'sticky', 
                    top: 0, 
                    backgroundColor: '#f5f5f5', 
                    zIndex: 10,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}>
                    <tr>
                      <th style={{ 
                        padding: '14px 16px', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #ddd',
                        fontWeight: '600',
                        color: '#333',
                        whiteSpace: 'nowrap',
                      }}>Tarix</th>
                      <th style={{ 
                        padding: '14px 16px', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #ddd',
                        fontWeight: '600',
                        color: '#333',
                        whiteSpace: 'nowrap',
                      }}>İstifadəçi</th>
                      <th style={{ 
                        padding: '14px 16px', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #ddd',
                        fontWeight: '600',
                        color: '#333',
                        whiteSpace: 'nowrap',
                      }}>Əməliyyat</th>
                      <th style={{ 
                        padding: '14px 16px', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #ddd',
                        fontWeight: '600',
                        color: '#333',
                        whiteSpace: 'nowrap',
                      }}>Tip</th>
                      <th style={{ 
                        padding: '14px 16px', 
                        textAlign: 'left', 
                        borderBottom: '2px solid #ddd',
                        fontWeight: '600',
                        color: '#333',
                      }}>Təsvir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                          Log tapılmadı
                        </td>
                      </tr>
                    ) : (
                      logs.map((log, index) => (
                        <tr 
                          key={log.id} 
                          style={{ 
                            borderBottom: '1px solid #eee',
                            backgroundColor: index % 2 === 0 ? 'white' : '#fafafa',
                          }}
                        >
                          <td style={{ padding: '12px 16px', border: '1px solid #eee' }}>{formatDate(log.created_at)}</td>
                          <td style={{ padding: '12px 16px', border: '1px solid #eee' }}>
                            {log.users?.email || 'Naməlum'}
                          </td>
                          <td style={{ padding: '12px 16px', border: '1px solid #eee' }}>
                            {getActionTypeLabel(log.action_type)}
                          </td>
                          <td style={{ padding: '12px 16px', border: '1px solid #eee' }}>
                            {getEntityTypeLabel(log.entity_type)}
                          </td>
                          <td style={{ padding: '12px 16px', border: '1px solid #eee', maxWidth: '500px', wordWrap: 'break-word' }}>
                            <div style={{ marginBottom: '4px' }}>{log.description}</div>
                            {log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0 && (
                              <div style={{ 
                                marginTop: '8px', 
                                padding: '8px', 
                                backgroundColor: '#f5f5f5', 
                                borderRadius: '4px',
                                fontSize: '12px',
                                color: '#666',
                              }}>
                                <strong>Detallar:</strong>
                                <pre style={{ 
                                  margin: '4px 0 0 0', 
                                  whiteSpace: 'pre-wrap', 
                                  wordBreak: 'break-word',
                                  fontFamily: 'inherit',
                                  fontSize: '12px',
                                }}>
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '10px', 
                alignItems: 'center',
                flexShrink: 0,
                paddingTop: '10px',
              }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: page === 1 ? '#ccc' : '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  Əvvəlki
                </button>
                <span>
                  Səhifə {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: page === totalPages ? '#ccc' : '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  Sonrakı
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <>
          <div style={{ marginBottom: '20px', flexShrink: 0 }}>
            <button
              onClick={handleNewUser}
              style={{
                padding: '12px 24px',
                backgroundColor: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#45a049'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'}
            >
              + Yeni İstifadəçi
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Yüklənir...</div>
          ) : (
            <div style={{ 
              overflowX: 'auto', 
              overflowY: 'auto',
              flex: 1,
              minHeight: '400px',
              maxHeight: 'calc(100vh - 350px)',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              backgroundColor: 'white',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ 
                    backgroundColor: '#f5f5f5',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  }}>
                    <th style={{ 
                      padding: '14px 16px', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #ddd',
                      fontWeight: '600',
                      color: '#333',
                    }}>ID</th>
                    <th style={{ 
                      padding: '14px 16px', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #ddd',
                      fontWeight: '600',
                      color: '#333',
                    }}>Email</th>
                    <th style={{ 
                      padding: '14px 16px', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #ddd',
                      fontWeight: '600',
                      color: '#333',
                    }}>Rol</th>
                    <th style={{ 
                      padding: '14px 16px', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #ddd',
                      fontWeight: '600',
                      color: '#333',
                    }}>Yaradılma tarixi</th>
                    <th style={{ 
                      padding: '14px 16px', 
                      textAlign: 'left', 
                      borderBottom: '2px solid #ddd',
                      fontWeight: '600',
                      color: '#333',
                    }}>Əməliyyatlar</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                        İstifadəçi tapılmadı
                      </td>
                    </tr>
                  ) : (
                    users.map((user, index) => (
                      <tr 
                        key={user.id} 
                        style={{ 
                          borderBottom: '1px solid #eee',
                          backgroundColor: index % 2 === 0 ? 'white' : '#fafafa',
                        }}
                      >
                        <td style={{ padding: '12px 16px', border: '1px solid #eee' }}>{user.id}</td>
                        <td style={{ padding: '12px 16px', border: '1px solid #eee' }}>{user.email}</td>
                        <td style={{ padding: '12px 16px', border: '1px solid #eee' }}>
                          <span
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              backgroundColor: user.role === 'admin' ? '#f44336' : '#2196F3',
                              color: 'white',
                              fontSize: '12px',
                              fontWeight: '500',
                            }}
                          >
                            {user.role === 'admin' ? 'Admin' : 'İstifadəçi'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', border: '1px solid #eee' }}>
                          {user.created_at ? formatDate(user.created_at) : '-'}
                        </td>
                        <td style={{ padding: '12px 16px', border: '1px solid #eee' }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleEditUser(user)}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#FF9800',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                                transition: 'background-color 0.2s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f57c00'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FF9800'}
                            >
                              Redaktə
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: '500',
                                transition: 'background-color 0.2s',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d32f2f'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f44336'}
                            >
                              Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* User Modal */}
      {showUserModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowUserModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '30px',
              borderRadius: '8px',
              maxWidth: '500px',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '20px' }}>
              {editingUser ? 'İstifadəçini Redaktə Et' : 'Yeni İstifadəçi Yarat'}
            </h2>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
              <input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>
                Şifrə{editingUser ? ' (boş buraxsanız dəyişməyəcək)' : ''}:
              </label>
              <input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Rol:</label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="user">İstifadəçi</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowUserModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Ləğv et
              </button>
              <button
                onClick={handleSaveUser}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                Yadda saxla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Files Tab */}
      {activeTab === 'logFiles' && (
        <>
          {loading ? (
            <div>Yüklənir...</div>
          ) : (
            <div style={{ 
              overflowX: 'auto', 
              overflowY: 'auto',
              flex: 1,
              minHeight: 0,
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>İstifadəçi ID</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Email</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Tam ad</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Fayl adı</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Ölçü</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Dəyişdirilmə tarixi</th>
                    <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #ddd' }}>Əməliyyatlar</th>
                  </tr>
                </thead>
                <tbody>
                  {logFiles.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '20px', textAlign: 'center', border: '1px solid #ddd' }}>
                        Log faylı yoxdur
                      </td>
                    </tr>
                  ) : (
                    logFiles.map((file) => (
                      <tr key={file.userId} style={{ borderBottom: '1px solid #ddd' }}>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{file.userId}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{file.userEmail}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{file.userFullName}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{file.fileName}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>{formatFileSize(file.size)}</td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                          {new Date(file.modifiedAt).toLocaleString('az-AZ')}
                        </td>
                        <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleDownloadLogFile(file.userId)}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              Yüklə
                            </button>
                            <button
                              onClick={() => handleSyncLogFile(file.userId)}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#FF9800',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              Sinxronizasiya
                            </button>
                            <button
                              onClick={() => handleDeleteLogFile(file.userId)}
                              style={{
                                padding: '5px 10px',
                                backgroundColor: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px',
                              }}
                            >
                              Sil
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      </div>
    </Layout>
  )
}
