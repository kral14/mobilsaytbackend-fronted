import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'

export default function Hesablar() {
  return (
    <ProtectedRoute>
      <Layout>
        <div style={{ padding: '2rem' }}>
          <h1>Hesablar</h1>
          <p>Hesablar səhifəsi hazırlanır...</p>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

