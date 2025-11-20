import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Toast from './Toast'

interface NavItem {
  path: string
  label: string
  icon: string
  requiresAuth?: boolean
}

const navItems: NavItem[] = [
  { path: '/', label: 'Ana Səhifə', icon: '🏠' },
  { path: '/products', label: 'Məhsullar', icon: '🛍️', requiresAuth: true },
  { path: '/hesablar', label: 'Hesablar', icon: '💰', requiresAuth: true },
  { path: '/anbar', label: 'Anbar', icon: '📦', requiresAuth: true },
  { path: '/qaimeler/alis', label: 'Alış Qaimələri', icon: '📋', requiresAuth: true },
  { path: '/qaimeler/satis', label: 'Satış Qaimələri', icon: '📄', requiresAuth: true },
  { path: '/kassa/medaxil', label: 'Kassa Medaxil', icon: '💵', requiresAuth: true },
  { path: '/kassa/mexaric', label: 'Kassa Mexaric', icon: '💸', requiresAuth: true },
  { path: '/musteriler/alici', label: 'Alıcılar', icon: '👥', requiresAuth: true },
  { path: '/musteriler/satici', label: 'Satıcılar', icon: '🏢', requiresAuth: true },
  { path: '/profile', label: 'Profil', icon: '👤', requiresAuth: true },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, customer, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  
  // Navbar görünürlüyü state-ləri
  const [topNavbarVisible, setTopNavbarVisible] = useState(() => {
    const saved = localStorage.getItem('topNavbarVisible')
    return saved !== null ? saved === 'true' : true
  })
  const [bottomNavbarVisible, setBottomNavbarVisible] = useState(() => {
    const saved = localStorage.getItem('bottomNavbarVisible')
    return saved !== null ? saved === 'true' : true
  })
  
  // Navbar görünürlüyünü localStorage-a yaz
  useEffect(() => {
    localStorage.setItem('topNavbarVisible', String(topNavbarVisible))
  }, [topNavbarVisible])
  
  useEffect(() => {
    localStorage.setItem('bottomNavbarVisible', String(bottomNavbarVisible))
  }, [bottomNavbarVisible])
  
  // localStorage-dan navbar görünürlüyünü oxu və yenilə
  useEffect(() => {
    const handleStorageChange = () => {
      const topVisible = localStorage.getItem('topNavbarVisible')
      const bottomVisible = localStorage.getItem('bottomNavbarVisible')
      if (topVisible !== null) {
        const newValue = topVisible === 'true'
        if (newValue !== topNavbarVisible) {
          setTopNavbarVisible(newValue)
        }
      }
      if (bottomVisible !== null) {
        const newValue = bottomVisible === 'true'
        if (newValue !== bottomNavbarVisible) {
          setBottomNavbarVisible(newValue)
        }
      }
    }
    
    // Storage event-lərini dinlə
    window.addEventListener('storage', handleStorageChange)
    
    // Custom event dinlə
    window.addEventListener('navbarVisibilityChange', handleStorageChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('navbarVisibilityChange', handleStorageChange)
    }
  }, [topNavbarVisible, bottomNavbarVisible])
  
  // Navbar-lar həmişə görünür olacaq (gesture funksiyası deaktivdir)
  
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const displayName = customer?.name || user?.email || 'İstifadəçi'

  // Ekran ölçüsünü yoxla
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024) // PC üçün (1024px və yuxarı)
      // PC-də menu avtomatik açıq olsun
      if (window.innerWidth >= 1024 && isAuthenticated) {
        setMenuOpen(true)
      } else if (window.innerWidth < 1024) {
        setMenuOpen(false)
      }
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [isAuthenticated])

  // Menu-nu bağla əgər kənara kliklənərsə
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      // Sidebar və ya overlay içindədirsə, heç nə etmə
      if (sidebarRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return
      }
      // Nav bar-dakı X düyməsinə basılıbsa, handleClickOutside işləməsin
      // Çünki X düyməsi artıq menu-nu bağlayır
      const navElement = (event.target as HTMLElement).closest('nav')
      if (navElement) {
        return
      }
      setMenuOpen(false)
    }

    if (menuOpen) {
      // Biraz gecikmə ilə əlavə et ki, X düyməsinin onClick-i əvvəl işləsin
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('touchstart', handleClickOutside)
      }, 100)

      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('touchstart', handleClickOutside)
      }
    }
  }, [menuOpen])

  // Route dəyişəndə menu-nu bağla
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])


  const handleLogout = () => {
    logout()
    navigate('/')
    setMenuOpen(false)
  }

  const visibleNavItems = navItems.filter(item => !item.requiresAuth || isAuthenticated)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      {topNavbarVisible && (
      <nav
        style={{
          background: '#1976d2',
          color: 'white',
          padding: '0.75rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'transform 0.3s ease-in-out',
        }}
      >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={(e) => {
              e.stopPropagation() // Event-in yayılmasını dayandır
              setMenuOpen(!menuOpen)
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.5rem',
              minWidth: '44px',
              minHeight: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1001, // Menu overlay-dən yuxarıda olsun
              position: 'relative',
            }}
            aria-label={menuOpen ? 'Menu bağla' : 'Menu aç'}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
          <Link
            to="/"
            style={{
              color: 'white',
              textDecoration: 'none',
              fontSize: '1.25rem',
              fontWeight: 'bold',
            }}
          >
            MobilSayt
          </Link>
        </div>

        {isAuthenticated && (
          <div style={{ fontSize: '0.875rem', textAlign: 'right' }}>
            <div style={{ fontWeight: 'bold' }}>{displayName}</div>
          </div>
        )}
      </nav>
      )}

      {/* Main Layout Container */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar - PC-də sabit, mobil üçün overlay */}
        {menuOpen && (
          <>
            {/* Mobil üçün overlay */}
            {!isDesktop && (
              <div
                ref={menuRef}
                onClick={(e) => {
                  // Yalnız overlay-ə kliklənəndə menu-nu bağla, Link-lərə kliklənəndə yox
                  if (e.target === e.currentTarget) {
                    setMenuOpen(false)
                  }
                }}
                style={{
                  position: 'fixed',
                  top: '56px',
                  left: 0,
                  right: 0,
                  bottom: '60px',
                  background: 'rgba(0,0,0,0.5)',
                  zIndex: 999,
                }}
              />
            )}
            {/* Sidebar Menu */}
            <div
              ref={sidebarRef}
              style={{
                background: 'white',
                width: '280px',
                height: isDesktop ? 'calc(100vh - 56px)' : 'calc(100vh - 56px - 60px)',
                overflowY: 'auto',
                boxShadow: isDesktop ? '2px 0 8px rgba(0,0,0,0.1)' : '2px 0 8px rgba(0,0,0,0.2)',
                position: isDesktop ? 'relative' : 'fixed',
                left: isDesktop ? 'auto' : 0,
                top: isDesktop ? 'auto' : '56px',
                zIndex: 1000,
                flexShrink: 0,
              }}
            >
            {visibleNavItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    color: isActive ? '#1976d2' : '#333',
                    textDecoration: 'none',
                    borderBottom: '1px solid #eee',
                    background: isActive ? '#e3f2fd' : 'transparent',
                    fontWeight: isActive ? 'bold' : 'normal',
                    minHeight: '44px',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              )
            })}

            {isAuthenticated && (
              <>
                <div style={{ borderTop: '2px solid #eee', margin: '0.5rem 0' }} />
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    background: 'transparent',
                    border: 'none',
                    color: '#d32f2f',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    minHeight: '44px',
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>🚪</span>
                  <span>Çıxış</span>
                </button>
              </>
            )}

            {!isAuthenticated && (
              <>
                <div style={{ borderTop: '2px solid #eee', margin: '0.5rem 0' }} />
                <Link
                  to="/login"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    color: '#1976d2',
                    textDecoration: 'none',
                    borderBottom: '1px solid #eee',
                    minHeight: '44px',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>🔐</span>
                  <span>Giriş</span>
                </Link>
                <Link
                  to="/register"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1rem',
                    color: '#1976d2',
                    textDecoration: 'none',
                    minHeight: '44px',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: '1.25rem' }}>📝</span>
                  <span>Qeydiyyat</span>
                </Link>
              </>
            )}
            </div>
          </>
        )}

        {/* Main Content */}
        <main
          style={{
            flex: 1,
            paddingTop: topNavbarVisible ? '0' : '0',
            // Aşağıda əlavə boşluq istəmirik, hər səhifə öz içində scroll idarə etsin
            paddingBottom: 0,
            // Burada vertical scroll-u bağlayırıq ki, məsələn Anbar səhifəsində
            // yalnız daxili cədvəl konteyneri yuxarı-aşağı hərəkət etsin
            overflowY: 'hidden',
            overflowX: 'hidden', // Səhifənin özündə sağa-sola scroll olmasın, yalnız daxili cədvəllər scroll olsun
            WebkitOverflowScrolling: 'touch',
            minWidth: 0, // Flex item overflow üçün
            touchAction: 'pan-y', // Mobil cihazlarda yalnız yuxarı-aşağı pan icazəsi ver
            // Scroll chaining-i blokla ki, daxili cədvəldən dartanda səhifə özü tərpənməsin
            overscrollBehavior: 'none',
          }}
        >
          {children}
        </main>
      </div>

      {/* Bottom Navigation tamamilə silindi */}
      
      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}


