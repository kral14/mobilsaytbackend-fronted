import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { ordersAPI } from '../services/api'
import type { SaleInvoice } from '../../../shared/types'
import { calculateDaysDifference } from '../utils/dateUtils'

export default function Home() {
  const { isAuthenticated } = useAuthStore()
  const [overdueInvoices, setOverdueInvoices] = useState<SaleInvoice[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      loadOverdueInvoices()
    }
  }, [isAuthenticated])

  const loadOverdueInvoices = async () => {
    try {
      setLoading(true)
      const invoices = await ordersAPI.getAll()
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const overdue = invoices.filter(invoice => {
        if (!invoice.payment_date) return false
        const paymentDate = new Date(invoice.payment_date)
        paymentDate.setHours(0, 0, 0, 0)
        return calculateDaysDifference(today, paymentDate) < 0
      })
      
      setOverdueInvoices(overdue)
    } catch (err) {
      console.error('Müddəti bitmiş ödənişlər yüklənərkən xəta:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout>
      <div style={{ padding: '1rem', maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: '#1976d2' }}>MobilSayt</h1>
          <p style={{ fontSize: '1rem', marginBottom: '1.5rem', color: '#666' }}>
            Alış-satış əməliyyatlarınızı rahatlıqla idarə edin
          </p>
          {isAuthenticated ? (
            <Link
              to="/products"
              style={{
                display: 'inline-block',
                padding: '0.875rem 1.5rem',
                background: '#1976d2',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: 'bold',
                minHeight: '44px',
              }}
            >
              Məhsullara bax
            </Link>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                to="/register"
                style={{
                  display: 'inline-block',
                  padding: '0.875rem 1.5rem',
                  background: '#1976d2',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  minHeight: '44px',
                }}
              >
                Qeydiyyat
              </Link>
              <Link
                to="/login"
                style={{
                  display: 'inline-block',
                  padding: '0.875rem 1.5rem',
                  background: 'transparent',
                  color: '#1976d2',
                  textDecoration: 'none',
                  border: '2px solid #1976d2',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  minHeight: '44px',
                }}
              >
                Giriş
              </Link>
            </div>
          )}
        </div>

        {/* Müddəti bitmiş ödənişlər */}
        {isAuthenticated && (
          <div style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: '#d32f2f' }}>
              ⚠️ Müddəti bitmiş ödənişlər
            </h2>
            {loading ? (
              <p style={{ textAlign: 'center', padding: '2rem' }}>Yüklənir...</p>
            ) : overdueInvoices.length === 0 ? (
              <div
                style={{
                  padding: '1.5rem',
                  background: '#d4edda',
                  borderRadius: '8px',
                  color: '#155724',
                  textAlign: 'center',
                }}
              >
                Müddəti bitmiş ödəniş yoxdur
              </div>
            ) : (
              <div
                style={{
                  background: '#fff3cd',
                  borderRadius: '8px',
                  padding: '1rem',
                  border: '2px solid #ffc107',
                  overflowX: 'auto',
                }}
              >
                <div style={{ minWidth: '600px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ background: '#ffc107', color: '#856404' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #ddd' }}>Faktura №</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left', border: '1px solid #ddd' }}>Müştəri</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right', border: '1px solid #ddd' }}>Məbləğ</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid #ddd' }}>Keçib</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdueInvoices.map((invoice) => {
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        const paymentDate = invoice.payment_date ? new Date(invoice.payment_date) : null
                        let daysOverdue = 0
                        if (paymentDate) {
                          paymentDate.setHours(0, 0, 0, 0)
                          daysOverdue = Math.abs(calculateDaysDifference(today, paymentDate))
                        }

                        return (
                          <tr key={invoice.id}>
                            <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>{invoice.invoice_number}</td>
                            <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}>
                              {invoice.customers?.name || '-'}
                            </td>
                            <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold' }}>
                              {invoice.total_amount ? Number(invoice.total_amount).toFixed(2) : '0.00'} ₼
                            </td>
                            <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'center', color: '#d32f2f', fontWeight: 'bold' }}>
                              {daysOverdue} gün
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#ffc107', fontWeight: 'bold' }}>
                        <td colSpan={2} style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'right' }}>
                          Cəmi:
                        </td>
                        <td style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'right' }}>
                          {overdueInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0).toFixed(2)} ₼
                        </td>
                        <td style={{ padding: '0.5rem', border: '1px solid #ddd' }}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <Link
                    to="/qaimeler/satis"
                    style={{
                      display: 'inline-block',
                      padding: '0.75rem 1.5rem',
                      background: '#007bff',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      minHeight: '44px',
                    }}
                  >
                    Bütün qaimələrə bax →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

