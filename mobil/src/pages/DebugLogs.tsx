import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Toast from '../components/Toast'
import { debugAPI, type ClientLogEntry } from '../services/api'

export default function DebugLogs() {
  const [logs, setLogs] = useState<ClientLogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const loadLogs = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await debugAPI.getClientLogs(200)
      setLogs(data)
    } catch (err: any) {
      console.error('Debug log-lar yüklənərkən xəta:', err)
      setError(err?.message || 'Debug log-lar yüklənə bilmədi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(() => {
      loadLogs()
    }, 5000)
    return () => clearInterval(id)
  }, [autoRefresh])

  const handleClear = async () => {
    try {
      await debugAPI.clearClientLogs()
      setLogs([])
      setToast({ message: 'Debug log-lar təmizləndi', type: 'success' })
    } catch (err: any) {
      setToast({ message: err?.message || 'Log-lar təmizlənə bilmədi', type: 'error' })
    }
  }

  return (
    <Layout>
      <div style={{ padding: '1rem', paddingTop: '4rem' }}>
        <h1 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Debug Log Pəncərəsi</h1>
        <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.75rem' }}>
          Burada mobil istifadəçilərdən gələn kamera / barkod və digər client xətalarını real vaxtda görə
          bilərsiniz. Bu səhifə yalnız admin/debug məqsədi üçündür.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            onClick={loadLogs}
            style={{
              padding: '0.4rem 0.8rem',
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Yenilə
          </button>
          <button
            onClick={handleClear}
            style={{
              padding: '0.4rem 0.8rem',
              background: '#d32f2f',
              color: 'white',
              border: 'none',
              borderRadius: 4,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
          >
            Təmizlə
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Avtomatik yenilə (5s)
          </label>
          {loading && <span style={{ fontSize: '0.85rem', color: '#555' }}>Yüklənir...</span>}
          {error && (
            <span style={{ fontSize: '0.85rem', color: '#d32f2f' }}>Xəta: {error}</span>
          )}
        </div>

        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: 6,
            maxHeight: '70vh',
            overflow: 'auto',
            background: '#0b1020',
            color: '#e0e0e0',
            fontFamily: 'monospace',
            fontSize: '0.78rem',
          }}
        >
          {logs.length === 0 ? (
            <div style={{ padding: '0.75rem', color: '#aaa' }}>Hələ heç bir log yoxdur.</div>
          ) : (
            logs
              .slice()
              .reverse()
              .map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderBottom: '1px solid #222',
                    background:
                      log.level === 'error'
                        ? 'rgba(211, 47, 47, 0.12)'
                        : 'rgba(25, 118, 210, 0.08)',
                  }}
                >
                  <div style={{ marginBottom: '0.15rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.1rem 0.35rem',
                        borderRadius: 3,
                        marginRight: '0.35rem',
                        fontSize: '0.7rem',
                        background: log.level === 'error' ? '#d32f2f' : '#1976d2',
                        color: 'white',
                      }}
                    >
                      {log.level.toUpperCase()}
                    </span>
                    <span style={{ color: '#9fa8da' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ marginBottom: '0.2rem' }}>{log.message}</div>
                  {log.context && (
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        color: '#c5e1a5',
                      }}
                    >
                      {JSON.stringify(log.context, null, 2)}
                    </pre>
                  )}
                </div>
              ))
          )}
        </div>

        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </Layout>
  )
}


