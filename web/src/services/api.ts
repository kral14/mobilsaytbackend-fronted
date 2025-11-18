import axios from 'axios'
import type { LoginRequest, RegisterRequest, AuthResponse, Product, SaleInvoice, CreateOrderRequest, User, Customer, PurchaseInvoice, Supplier } from '../../shared/types'

// API URL-i müəyyən et
const getApiBaseUrl = () => {
  // Əgər environment variable varsa, onu istifadə et (Render üçün)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // Development üçün: localhost və ya proxy
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  
  if (isLocalhost) {
    // Development: birbaşa API
    return 'http://localhost:5000/api'
  }
  
  // Production: eyni domain-dən API (proxy ilə)
  return '/api'
}

const API_BASE_URL = getApiBaseUrl()

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token əlavə etmək üçün interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auth API
export const authAPI = {
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/login', data)
    return response.data
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/auth/register', data)
    return response.data
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    localStorage.removeItem('customer')
  },
}

// Products API
export const productsAPI = {
  getAll: async (): Promise<Product[]> => {
    const response = await api.get<Product[]>('/products')
    return response.data
  },

  getById: async (id: string): Promise<Product> => {
    const response = await api.get<Product>(`/products/${id}`)
    return response.data
  },

  create: async (data: {
    name: string
    barcode?: string
    description?: string
    unit?: string
    purchase_price?: number
    sale_price?: number
    code?: string
  }): Promise<Product> => {
    const response = await api.post<Product>('/products', data)
    return response.data
  },

  update: async (id: string, data: Partial<Product>): Promise<Product> => {
    const response = await api.put<Product>(`/products/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/products/${id}`)
  },
}

// Categories API
export const categoriesAPI = {
  getAll: async (): Promise<any[]> => {
    const response = await api.get<any[]>('/categories')
    return response.data
  },

  create: async (data: { name: string; parent_id?: number }): Promise<any> => {
    const response = await api.post<any>('/categories', data)
    return response.data
  },

  update: async (id: string, data: { name: string; parent_id?: number }): Promise<any> => {
    const response = await api.put<any>(`/categories/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/categories/${id}`)
  },

  moveProducts: async (product_ids: number[], category_id: number | null): Promise<void> => {
    await api.post('/categories/move-products', { product_ids, category_id })
  },
}

// Orders API (Sale Invoices)
export const ordersAPI = {
  getAll: async (): Promise<SaleInvoice[]> => {
    const response = await api.get<SaleInvoice[]>('/orders')
    return response.data
  },

  getById: async (id: string): Promise<SaleInvoice> => {
    const response = await api.get<SaleInvoice>(`/orders/${id}`)
    return response.data
  },

  create: async (data: CreateOrderRequest): Promise<SaleInvoice> => {
    const response = await api.post<SaleInvoice>('/orders', data)
    return response.data
  },

  update: async (id: string, data: { customer_id?: number; items?: any[]; notes?: string; payment_date?: string; invoice_number?: string; invoice_date?: string }): Promise<SaleInvoice> => {
    const response = await api.put<SaleInvoice>(`/orders/${id}`, data)
    return response.data
  },

  updateStatus: async (id: string, is_active: boolean): Promise<SaleInvoice> => {
    const response = await api.patch<SaleInvoice>(`/orders/${id}/status`, { is_active })
    return response.data
  },
}

// Purchase Invoices API
export const purchaseInvoicesAPI = {
  getAll: async (): Promise<PurchaseInvoice[]> => {
    const response = await api.get<PurchaseInvoice[]>('/purchase-invoices')
    return response.data
  },

  getById: async (id: string): Promise<PurchaseInvoice> => {
    const response = await api.get<PurchaseInvoice>(`/purchase-invoices/${id}`)
    return response.data
  },

  create: async (data: {
    supplier_id?: number
    items: {
      product_id: number
      quantity: number
      unit_price: number
      total_price: number
    }[]
    notes?: string
  }): Promise<PurchaseInvoice> => {
    const response = await api.post<PurchaseInvoice>('/purchase-invoices', data)
    return response.data
  },

  update: async (id: string, data: { supplier_id?: number; items?: any[]; notes?: string; is_active?: boolean }): Promise<PurchaseInvoice> => {
    const response = await api.patch<PurchaseInvoice>(`/purchase-invoices/${id}`, data)
    return response.data
  },

  updateStatus: async (id: string, is_active: boolean): Promise<PurchaseInvoice> => {
    const response = await api.patch<PurchaseInvoice>(`/purchase-invoices/${id}/status`, { is_active })
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/purchase-invoices/${id}`)
  },
}

// Customers API
export const customersAPI = {
  getAll: async (): Promise<Customer[]> => {
    const response = await api.get<Customer[]>('/customers')
    return response.data
  },
}

// Customer Folders API
export const customerFoldersAPI = {
  getAll: async (): Promise<any[]> => {
    const response = await api.get<any[]>('/customer-folders')
    return response.data
  },

  create: async (data: { name: string; parent_id?: number | null }): Promise<any> => {
    const response = await api.post<any>('/customer-folders', data)
    return response.data
  },

  update: async (id: string, data: { name: string; parent_id?: number | null }): Promise<any> => {
    const response = await api.put<any>(`/customer-folders/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/customer-folders/${id}`)
  },
}

// Suppliers API
export const suppliersAPI = {
  getAll: async (): Promise<Supplier[]> => {
    const response = await api.get<Supplier[]>('/suppliers')
    return response.data
  },
}

// User API
export const userAPI = {
  getProfile: async (): Promise<{ user: User; customer: Customer | null }> => {
    const response = await api.get<{ user: User; customer: Customer | null }>('/users/profile')
    return response.data
  },

  updateProfile: async (data: { name?: string; phone?: string; address?: string }): Promise<{ user: User; customer: Customer }> => {
    const response = await api.put<{ user: User; customer: Customer }>('/users/profile', data)
    return response.data
  },
}

export default api
