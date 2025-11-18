import Layout from '../../components/Layout'
import ProtectedRoute from '../../components/ProtectedRoute'

export default function Alicilar() {
  return (
    <ProtectedRoute>
      <Layout>
        <div style={{ padding: '2rem' }}>
          <h1>Alıcılar</h1>
          <p>Alıcılar siyahısı hazırlanır...</p>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

