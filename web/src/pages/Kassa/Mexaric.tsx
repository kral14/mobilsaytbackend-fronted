import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'

export default function KassaMexaric() {
  return (
    <ProtectedRoute>
      <Layout>
        <div style={{ padding: '2rem' }}>
          <h1>Kassa - Mexaric</h1>
          <p>Kassa mexaric səhifəsi hazırlanır...</p>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

