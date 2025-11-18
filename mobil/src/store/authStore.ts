import { create } from 'zustand'
import type { User, Customer } from '../../../shared/types'
import { authAPI } from '../services/api'

interface AuthState {
  user: User | null
  customer: Customer | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string, phone?: string) => Promise<void>
  logout: () => void
  setUser: (user: User) => void
  setCustomer: (customer: Customer) => void
}

export const useAuthStore = create<AuthState>((set) => {
  // localStorage-dan ilkin dəyərləri yüklə
  const storedToken = localStorage.getItem('token')
  const storedUser = localStorage.getItem('user')
  const storedCustomer = localStorage.getItem('customer')
  
  return {
    user: storedUser ? JSON.parse(storedUser) : null,
    customer: storedCustomer ? JSON.parse(storedCustomer) : null,
    token: storedToken,
    isAuthenticated: !!storedToken,

    login: async (email: string, password: string) => {
      const response = await authAPI.login({ email, password })
      localStorage.setItem('token', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))
      if (response.customer) {
        localStorage.setItem('customer', JSON.stringify(response.customer))
      }
      set({
        user: response.user,
        customer: response.customer || null,
        token: response.token,
        isAuthenticated: true,
      })
    },

    register: async (email: string, password: string, name: string, phone?: string) => {
      const response = await authAPI.register({ email, password, name, phone })
      localStorage.setItem('token', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))
      if (response.customer) {
        localStorage.setItem('customer', JSON.stringify(response.customer))
      }
      set({
        user: response.user,
        customer: response.customer || null,
        token: response.token,
        isAuthenticated: true,
      })
    },

    logout: () => {
      authAPI.logout()
      set({
        user: null,
        customer: null,
        token: null,
        isAuthenticated: false,
      })
    },

    setUser: (user: User) => {
      localStorage.setItem('user', JSON.stringify(user))
      set({ user, isAuthenticated: true })
    },

    setCustomer: (customer: Customer) => {
      localStorage.setItem('customer', JSON.stringify(customer))
      set({ customer })
    },
  }
})

