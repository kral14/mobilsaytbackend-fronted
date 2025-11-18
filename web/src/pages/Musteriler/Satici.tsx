import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'

export default function Saticilar() {
  return (
    <ProtectedRoute>
      <Layout>
        <div style={{ padding: '2rem' }}>
          <h1>Satıcılar</h1>
          <p>Satıcılar siyahısı hazırlanır...</p>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

