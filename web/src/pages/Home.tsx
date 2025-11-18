import React, { useState, useEffect } from 'react'
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
      <div style={{ padding: '3rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>MobilSayt</h1>
          <p style={{ fontSize: '1.2rem', marginBottom: '2rem', color: '#666' }}>
            Alış-satış əməliyyatlarınızı rahatlıqla idarə edin
          </p>
          {isAuthenticated ? (
            <Link
              to="/products"
              style={{
                display: 'inline-block',
                padding: '1rem 2rem',
                background: '#1976d2',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '1.1rem'
              }}
            >
              Məhsullara bax
            </Link>
          ) : (
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Link
                to="/register"
                style={{
                  display: 'inline-block',
                  padding: '1rem 2rem',
                  background: '#1976d2',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontSize: '1.1rem'
                }}
              >
                Qeydiyyat
              </Link>
              <Link
                to="/login"
                style={{
                  display: 'inline-block',
                  padding: '1rem 2rem',
                  background: 'transparent',
                  color: '#1976d2',
                  textDecoration: 'none',
                  border: '2px solid #1976d2',
                  borderRadius: '4px',
                  fontSize: '1.1rem'
                }}
              >
                Giriş
              </Link>
            </div>
          )}
        </div>

        {/* Müddəti bitmiş ödənişlər */}
        {isAuthenticated && (
          <div style={{ marginTop: '3rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#dc3545' }}>
              ⚠️ Müddəti bitmiş ödənişlər
            </h2>
            {loading ? (
              <p>Yüklənir...</p>
            ) : overdueInvoices.length === 0 ? (
              <div style={{ 
                padding: '2rem', 
                background: '#d4edda', 
                borderRadius: '8px', 
                color: '#155724',
                textAlign: 'center'
              }}>
                Müddəti bitmiş ödəniş yoxdur
              </div>
            ) : (
              <div style={{ 
                background: '#fff3cd', 
                borderRadius: '8px', 
                padding: '1rem',
                border: '2px solid #ffc107'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#ffc107', color: '#856404' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Faktura №</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Müştəri</th>
                      <th style={{ padding: '0.75rem', textAlign: 'right', border: '1px solid #ddd' }}>Məbləğ</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>Son ödəniş tarixi</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center', border: '1px solid #ddd' }}>Keçib</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueInvoices.map(invoice => {
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
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{invoice.invoice_number}</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>{invoice.customers?.name || '-'}</td>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right', fontWeight: 'bold' }}>
                            {invoice.total_amount ? Number(invoice.total_amount).toFixed(2) : '0.00'} ₼
                          </td>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center' }}>
                            {paymentDate ? paymentDate.toLocaleDateString('az-AZ') : '-'}
                          </td>
                          <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'center', color: '#dc3545', fontWeight: 'bold' }}>
                            {daysOverdue} gün
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#ffc107', fontWeight: 'bold' }}>
                      <td colSpan={2} style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right' }}>Cəmi:</td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd', textAlign: 'right' }}>
                        {overdueInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0).toFixed(2)} ₼
                      </td>
                      <td colSpan={2} style={{ padding: '0.75rem', border: '1px solid #ddd' }}></td>
                    </tr>
                  </tfoot>
                </table>
                <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                  <Link
                    to="/qaimeler/satis"
                    style={{
                      display: 'inline-block',
                      padding: '0.5rem 1rem',
                      background: '#007bff',
                      color: 'white',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      fontSize: '0.9rem'
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
