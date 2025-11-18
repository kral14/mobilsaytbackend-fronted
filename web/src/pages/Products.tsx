import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import ProtectedRoute from '../components/ProtectedRoute'
import { productsAPI } from '../services/api'
import type { Product } from '../../../shared/types'

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const data = await productsAPI.getAll()
      setProducts(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Məhsullar yüklənərkən xəta baş verdi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
          <h1 style={{ marginBottom: '2rem' }}>Məhsullar</h1>
          
          {loading && <p>Yüklənir...</p>}
          {error && (
            <div style={{ background: '#ffebee', color: '#c62828', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
              {error}
            </div>
          )}
          
          {!loading && !error && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {products.length === 0 ? (
                <p>Hələ məhsul yoxdur</p>
              ) : (
                products.map((product) => {
                  const warehouse = (product as any).warehouse?.[0]
                  return (
                    <div
                      key={product.id}
                      style={{
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        padding: '1rem',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      <h3 style={{ marginBottom: '0.5rem' }}>{product.name}</h3>
                      {product.description && (
                        <p style={{ color: '#666', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{product.description}</p>
                      )}
                      <div style={{ marginBottom: '0.5rem' }}>
                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1976d2' }}>
                          {product.sale_price || 0} AZN
                        </p>
                        {product.purchase_price && (
                          <p style={{ fontSize: '0.9rem', color: '#999', textDecoration: 'line-through' }}>
                            Alış: {product.purchase_price} AZN
                          </p>
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                        <p>Vahid: {product.unit || 'ədəd'}</p>
                        {product.barcode && <p>Barkod: {product.barcode}</p>}
                        {product.code && <p>Kod: {product.code}</p>}
                        {warehouse && <p>Anbar: {warehouse.quantity || 0} {product.unit || 'ədəd'}</p>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
