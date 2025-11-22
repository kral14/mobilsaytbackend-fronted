import axios from 'axios'
import type { LoginRequest, RegisterRequest, AuthResponse, Product, SaleInvoice, CreateOrderRequest, User, Customer, PurchaseInvoice, Supplier } from '@shared/types'

// API URL-i müəyyən et
const getApiBaseUrl = () => {
  // Əgər environment variable varsa, onu istifadə et (deployment mühiti üçün)
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
    article?: string
    category_id?: number | null
    type?: string
    brand?: string
    model?: string
    color?: string
    country?: string
    manufacturer?: string
    warranty_period?: number
    production_date?: string
    expiry_date?: string
    is_active?: boolean
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

  update: async (id: string, data: { name?: string; parent_id?: number }): Promise<any> => {
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

// Customer Folders API (Alıcılar üçün)
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

// Supplier Folders API (Satıcılar üçün)
export const supplierFoldersAPI = {
  getAll: async (): Promise<any[]> => {
    const response = await api.get<any[]>('/supplier-folders')
    return response.data
  },

  create: async (data: { name: string; parent_id?: number | null }): Promise<any> => {
    const response = await api.post<any>('/supplier-folders', data)
    return response.data
  },

  update: async (id: string, data: { name: string; parent_id?: number | null }): Promise<any> => {
    const response = await api.put<any>(`/supplier-folders/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/supplier-folders/${id}`)
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

// Logs API
export const logsAPI = {
  getAll: async (params?: {
    page?: number
    limit?: number
    action_type?: string
    entity_type?: string
    start_date?: string
    end_date?: string
    user_id?: string
    entity_id?: string
  }): Promise<{
    logs: any[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> => {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.action_type) queryParams.append('action_type', params.action_type)
    if (params?.entity_type) queryParams.append('entity_type', params.entity_type)
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)
    if (params?.user_id) queryParams.append('user_id', params.user_id)
    if (params?.entity_id) queryParams.append('entity_id', params.entity_id)

    const response = await api.get(`/logs?${queryParams.toString()}`)
    return response.data
  },

  getInvoiceNumbers: async (entityType: string): Promise<{
    invoices: Array<{
      id: number
      invoice_number: string
    }>
  }> => {
    const response = await api.get(`/logs/invoice-numbers?entity_type=${entityType}`)
    return response.data
  },

  deleteOld: async (days: number): Promise<{ message: string; deleted_count: number }> => {
    const response = await api.delete('/logs', { data: { days } })
    return response.data
  },

  // Log faylları
  getAllLogFiles: async (): Promise<{
    logFiles: Array<{
      userId: number
      fileName: string
      filePath: string
      size: number
      createdAt: Date
      modifiedAt: Date
      userEmail: string
      userFullName: string
    }>
  }> => {
    const response = await api.get('/logs/files')
    return response.data
  },

  downloadLogFile: async (userId: number): Promise<Blob> => {
    const response = await api.get(`/logs/files/${userId}/download`, {
      responseType: 'blob',
    })
    return response.data
  },

  deleteLogFile: async (userId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/logs/files/${userId}`)
    return response.data
  },

  syncLogFile: async (userId: number): Promise<{ message: string }> => {
    const response = await api.post(`/logs/files/${userId}/sync`)
    return response.data
  },
}

// Users API (Admin üçün)
export const usersAPI = {
  getAll: async (): Promise<User[]> => {
    const response = await api.get<User[]>('/users')
    return response.data
  },

  create: async (data: { email: string; password: string; role: string }): Promise<User> => {
    const response = await api.post<User>('/users', data)
    return response.data
  },

  update: async (id: string, data: { email?: string; password?: string; role?: string }): Promise<User> => {
    const response = await api.put<User>(`/users/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`)
  },
}

export default api
