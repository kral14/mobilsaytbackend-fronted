import { useState, useEffect } from 'react'
import Layout from '../../components/Layout'
import Toast from '../../components/Toast'
import { paymentsAPI, customersAPI } from '../../services/api'
import type { Payment, Customer, CashBalance } from '@shared/types'

export default function KassaMedaxil() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [balance, setBalance] = useState<CashBalance | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    customer_id: null as number | null,
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
  })
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  useEffect(() => {
    loadPayments()
    loadCustomers()
    loadBalance()
  }, [])

  const loadPayments = async () => {
    setLoading(true)
    try {
      const data = await paymentsAPI.getAll({ payment_type: 'customer' })
      setPayments(data)
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Ödənişlər yüklənə bilmədi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadCustomers = async () => {
    try {
      const data = await customersAPI.getAll()
      setCustomers(data)
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Müştərilər yüklənə bilmədi', 'error')
    }
  }

  const loadBalance = async () => {
    try {
      const data = await paymentsAPI.getBalance()
      setBalance(data)
    } catch (err: any) {
      console.error('Balans yüklənə bilmədi:', err)
    }
  }

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!paymentForm.customer_id) {
      showToast('Müştəri seçilməlidir', 'error')
      return
    }

    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      showToast('Ödəniş məbləği müsbət olmalıdır', 'error')
      return
    }

    setLoading(true)
    try {
      await paymentsAPI.createCustomerPayment({
        customer_id: paymentForm.customer_id,
        amount: parseFloat(paymentForm.amount),
        payment_date: paymentForm.payment_date,
        notes: paymentForm.notes || undefined,
      })
      showToast('Ödəniş uğurla yaradıldı', 'success')
      setShowPaymentModal(false)
      setPaymentForm({
        customer_id: null,
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        notes: '',
      })
      loadPayments()
      loadBalance()
      loadCustomers() // Balans yenilənməsi üçün
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Ödəniş yaradıla bilmədi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Bu ödənişi silmək istədiyinizə əminsiniz?')) {
      return
    }

    setLoading(true)
    try {
      await paymentsAPI.delete(id)
      showToast('Ödəniş silindi', 'success')
      loadPayments()
      loadBalance()
      loadCustomers() // Balans yenilənməsi üçün
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Ödəniş silinə bilmədi', 'error')
    } finally {
      setLoading(false)
    }
  }

  const selectedCustomer = customers.find(c => c.id === paymentForm.customer_id)

  return (
    <Layout>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Kassa Medaxil (Müştərilərdən Ödəniş)</h1>
          <button
            onClick={() => setShowPaymentModal(true)}
            style={{
              padding: '0.5rem 1rem',
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            + Yeni Ödəniş
          </button>
        </div>

        {balance && (
          <div style={{
            background: '#e3f2fd',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-around',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>Ümumi Gəlir</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1976d2' }}>
                {balance.total_income.toFixed(2)} AZN
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>Ümumi Xərc</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#d32f2f' }}>
                {balance.total_expense.toFixed(2)} AZN
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>Kassa Balansı</div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: balance.balance >= 0 ? '#2e7d32' : '#d32f2f',
              }}>
                {balance.balance.toFixed(2)} AZN
              </div>
            </div>
          </div>
        )}

        {loading && payments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Yüklənir...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Tarix</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Müştəri</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Məbləğ</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Qeyd</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '2px solid #ddd' }}>Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                      Ödəniş yoxdur
                    </td>
                  </tr>
                ) : (
                  payments.map((payment) => (
                    <tr key={payment.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.75rem' }}>
                        {payment.payment_date
                          ? new Date(payment.payment_date).toLocaleDateString('az-AZ')
                          : '-'}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {payment.customers?.name || '-'}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: '#2e7d32' }}>
                        {Number(payment.amount).toFixed(2)} AZN
                      </td>
                      <td style={{ padding: '0.75rem', color: '#666' }}>
                        {payment.notes || '-'}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDelete(payment.id)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#d32f2f',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                          }}
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {showPaymentModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setShowPaymentModal(false)}
          >
            <div
              style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '8px',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '90vh',
                overflowY: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginTop: 0 }}>Yeni Ödəniş</h2>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Müştəri *
                  </label>
                  <select
                    value={paymentForm.customer_id || ''}
                    onChange={(e) => setPaymentForm({ ...paymentForm, customer_id: e.target.value ? parseInt(e.target.value) : null })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem',
                    }}
                    required
                  >
                    <option value="">Müştəri seçin</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} {customer.balance !== null && `(Borc: ${Number(customer.balance).toFixed(2)} AZN)`}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCustomer && selectedCustomer.balance !== null && (
                  <div style={{
                    marginBottom: '1rem',
                    padding: '0.75rem',
                    background: '#fff3cd',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                  }}>
                    <strong>Cari borc:</strong> {Number(selectedCustomer.balance).toFixed(2)} AZN
                  </div>
                )}

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Məbləğ (AZN) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem',
                    }}
                    required
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Ödəniş Tarixi
                  </label>
                  <input
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Qeyd
                  </label>
                  <textarea
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      fontSize: '1rem',
                      minHeight: '80px',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#ccc',
                      color: 'black',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Ləğv et
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#1976d2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                    }}
                  >
                    {loading ? 'Yaradılır...' : 'Yadda saxla'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

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
