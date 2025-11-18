import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

