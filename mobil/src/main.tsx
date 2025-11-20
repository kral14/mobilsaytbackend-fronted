import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { clientLog } from './services/api'

// Lokal development üçün (3000 ↔ 3001) avtomatik yönləndirmə
const setupLocalPortRedirect = () => {
  // Yalnız dev mühitində və localhost-da işlə
  if (
    import.meta.env.PROD ||
    (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
  ) {
    return
  }

  const DESKTOP_PORT = '3000'
  const MOBILE_PORT = '3001'
  const BREAKPOINT = 768 // 768px-dən kiçik ekranları mobil say

  const redirectIfNeeded = () => {
    const width = window.innerWidth || document.documentElement.clientWidth
    const currentPort = window.location.port || DESKTOP_PORT

    // Desktop (3000) → Mobile (3001)
    if (width <= BREAKPOINT && currentPort === DESKTOP_PORT) {
      const { pathname, search, hash } = window.location
      window.location.href = `http://localhost:${MOBILE_PORT}${pathname}${search}${hash}`
      return
    }

    // Mobile (3001) → Desktop (3000)
    if (width > BREAKPOINT && currentPort === MOBILE_PORT) {
      const { pathname, search, hash } = window.location
      window.location.href = `http://localhost:${DESKTOP_PORT}${pathname}${search}${hash}`
    }
  }

  // İlk yükləmədə yoxla
  redirectIfNeeded()

  // Ekran ölçüsü dəyişəndə yoxla
  window.addEventListener('resize', redirectIfNeeded)
}

setupLocalPortRedirect()

// Qlobal error handler-lar – bütün JS xətalarını server debug log-a göndər
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    try {
      clientLog('error', 'Unhandled error', {
        message: event.error?.message || event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
      })
    } catch {
      // log xətası ignore
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason: any = event.reason
      clientLog('error', 'Unhandled promise rejection', {
        message: reason?.message || String(reason),
        stack: reason?.stack,
      })
    } catch {
      // log xətası ignore
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

