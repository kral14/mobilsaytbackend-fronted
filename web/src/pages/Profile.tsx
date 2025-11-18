import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { useAuthStore } from '../store/authStore'

export default function Profile() {
  const { user, customer } = useAuthStore()

  return (
    <ProtectedRoute>
      <Layout>
        <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
          <h1>Profil</h1>
          {user && (
            <div style={{ marginTop: '2rem' }}>
              <h2 style={{ marginBottom: '1rem' }}>İstifadəçi Məlumatları</h2>
              <div style={{ marginBottom: '1rem' }}>
                <strong>Email:</strong> {user.email}
              </div>
              
              {customer && (
                <>
                  <h2 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Müştəri Məlumatları</h2>
                  <div style={{ marginBottom: '1rem' }}>
                    <strong>Ad:</strong> {customer.name}
                  </div>
                  {customer.phone && (
                    <div style={{ marginBottom: '1rem' }}>
                      <strong>Telefon:</strong> {customer.phone}
                    </div>
                  )}
                  {customer.address && (
                    <div style={{ marginBottom: '1rem' }}>
                      <strong>Ünvan:</strong> {customer.address}
                    </div>
                  )}
                  {customer.balance !== null && (
                    <div style={{ marginBottom: '1rem' }}>
                      <strong>Balans:</strong> {customer.balance} AZN
                    </div>
                  )}
                </>
              )}
              
              {!customer && (
                <p style={{ marginTop: '1rem', color: '#666' }}>
                  Müştəri məlumatları yoxdur. Profil səhifəsində redaktə edərək əlavə edə bilərsiniz.
                </p>
              )}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
