import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'

export default function KassaMedaxil() {
  return (
    <ProtectedRoute>
      <Layout>
        <div style={{ padding: '2rem' }}>
          <h1>Kassa - Medaxil</h1>
          <p>Kassa medaxil səhifəsi hazırlanır...</p>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

