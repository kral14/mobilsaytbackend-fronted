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
  const [qaimelerMenuOpen, setQaimelerMenuOpen] = useState(false)
  const [kassaMenuOpen, setKassaMenuOpen] = useState(false)
  const [carilerMenuOpen, setCarilerMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  
  // Navbar görünürlüyü (localStorage-dan oxu)
  const [topNavbarVisible, setTopNavbarVisible] = useState(() => {
    const saved = localStorage.getItem('topNavbarVisible')
    return saved !== 'false' // Default: true, yalnız açıq şəkildə false olarsa false qaytar
  })
  const [bottomNavbarVisible, setBottomNavbarVisible] = useState(() => {
    const saved = localStorage.getItem('bottomNavbarVisible')
    return saved !== 'false' // Default: true, yalnız açıq şəkildə false olarsa false qaytar
  })
  
  // Navbar görünürlüyünü localStorage-a yaz
  useEffect(() => {
    localStorage.setItem('topNavbarVisible', String(topNavbarVisible))
  }, [topNavbarVisible])
  
  useEffect(() => {
    localStorage.setItem('bottomNavbarVisible', String(bottomNavbarVisible))
  }, [bottomNavbarVisible])
  
  
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
  
  // Scroll gesture detection (sənin istədiyin qaydada sadə loqika)
// FINAL — Correct Touch Gesture Logic
// FINAL — TOUCH GESTURE WITH LOCK DELAY
// FINAL — LOCKED TOUCH GESTURES WITH STATE-AWARE LOGIC
// FINAL — TOUCH GESTURES WITH PERFECT LOCK & RESET
useEffect(() => {
  if (!isAuthenticated || isDesktop) return

  let startY = 0
  let lastDir: 'up' | 'down' | null = null
  let count = 0
  let lastGestureTime = 0

  let locked = false
  const LOCK_DELAY = 5000 // 3 saniyə

  const resetGesture = () => {
    count = 0
    lastDir = null
  }

  const lockGestures = () => {
    locked = true
    resetGesture()
    setTimeout(() => {
      locked = false
    }, LOCK_DELAY)
  }

  const handleTouchStart = (e: TouchEvent) => {
    startY = e.touches[0].clientY
  }

  const handleTouchMove = (e: TouchEvent) => {
    // ❌ Lock aktivdirsə — gesture qətiyyən sayılmır
    if (locked) return

    const currentY = e.touches[0].clientY
    const delta = currentY - startY

    if (Math.abs(delta) < 30) return

    const dir: 'up' | 'down' = delta < 0 ? 'up' : 'down'
    const now = Date.now()

    // istiqamət dəyişibsə və ya gecikibsə → reset
    if (dir !== lastDir || now - lastGestureTime > 900) {
      resetGesture()
    }

    // çox tez gələn event → sayma
    if (now - lastGestureTime < 120) return

    count++
    lastDir = dir
    lastGestureTime = now

    //
    // YUXARI NAVBAR GESTURE
    //
    if (dir === 'up') {
      // 3 UP → GİZLƏ (yalnız görünürsə)
      if (count === 3 && topNavbarVisible) {
        setTopNavbarVisible(false)
        setToast({ message: 'Yuxarı navbar gizləndi', type: 'info' })
        lockGestures()
        return
      }

      // 2 UP → GÖSTƏR (yalnız gizlidirsə)
      if (count === 2 && !topNavbarVisible) {
        setTopNavbarVisible(true)
        setToast({ message: 'Yuxarı navbar göstərildi', type: 'success' })
        lockGestures()
        return
      }
    }

    //
    // ALT NAVBAR GESTURE
    //
    if (dir === 'down') {
      // 3 DOWN → GİZLƏ (yalnız görünürsə)
      if (count === 3 && bottomNavbarVisible) {
        setBottomNavbarVisible(false)
        setToast({ message: 'Aşağı navbar gizləndi', type: 'info' })
        lockGestures()
        return
      }

      // 2 DOWN → GÖSTƏR (yalnız gizlidirsə)
      if (count === 2 && !bottomNavbarVisible) {
        setBottomNavbarVisible(true)
        setToast({ message: 'Aşağı navbar göstərildi', type: 'success' })
        lockGestures()
        return
      }
    }

    startY = currentY
  }

  document.body.addEventListener('touchstart', handleTouchStart, { passive: true })
  document.body.addEventListener('touchmove', handleTouchMove, { passive: true })

  return () => {
    document.body.removeEventListener('touchstart', handleTouchStart)
    document.body.removeEventListener('touchmove', handleTouchMove)
  }
}, [isAuthenticated, isDesktop, topNavbarVisible, bottomNavbarVisible])


  const handleLogout = () => {
    logout()
    navigate('/')
    setMenuOpen(false)
  }

  const visibleNavItems = navItems.filter(item => !item.requiresAuth || isAuthenticated)
  
  // Bottom nav items - Məhsulları çıxartdıq
  const bottomNavItems = [
    { path: '/', label: 'Ana Səhifə', icon: '🏠', type: 'link' as const },
    { path: '/qaimeler', label: 'Qaimələr', icon: '📄', type: 'submenu' as const, submenu: [
      { path: '/qaimeler/alis', label: 'Alış Qaimə', icon: '📋' },
      { path: '/qaimeler/satis', label: 'Satış Qaimə', icon: '📄' }
    ]},
    { path: '/kassa', label: 'Kassa', icon: '💵', type: 'submenu' as const, submenu: [
      { path: '/kassa/medaxil', label: 'Kassa Medaxil', icon: '💵' },
      { path: '/kassa/mexaric', label: 'Kassa Mexaric', icon: '💸' }
    ]},
    { path: '/cariler', label: 'Carilər', icon: '👥', type: 'submenu' as const, submenu: [
      { path: '/musteriler/alici', label: 'Alıcılar', icon: '🧑‍🤝‍🧑' },
      { path: '/musteriler/satici', label: 'Satıcılar', icon: '🏢' }
    ]},
    { path: '/hesablar', label: 'Hesablar', icon: '💰', type: 'link' as const },
    { path: '/anbar', label: 'Anbar', icon: '📦', type: 'link' as const },
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <nav
        style={{
          background: '#1976d2',
          color: 'white',
          padding: '0.75rem 1rem',
          display: topNavbarVisible ? 'flex' : 'none',
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
            paddingBottom: isAuthenticated && !isDesktop ? '70px' : '0',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            minWidth: 0, // Flex item overflow üçün
          }}
        >
          {children}
        </main>
      </div>

      {/* Bottom Navigation (only for authenticated users and mobile) */}
      {isAuthenticated && !isDesktop && (
        <>
          <nav
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'white',
              borderTop: '1px solid #e0e0e0',
              display: bottomNavbarVisible ? 'flex' : 'none',
              justifyContent: 'space-around',
              alignItems: 'center',
              padding: '0.5rem 0',
              zIndex: 1001,
              boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
              pointerEvents: 'auto',
              transition: 'transform 0.3s ease-in-out',
            }}
          >
            {bottomNavItems.map((item) => {
              const isActive = item.type === 'link' 
                ? location.pathname === item.path
                : item.submenu?.some(sub => location.pathname === sub.path) || false
              
              if (item.type === 'submenu') {
                return (
                  <div key={item.path} style={{ position: 'relative' }}>
                    <button
                      onClick={() => {
                        if (item.path === '/qaimeler') {
                          setQaimelerMenuOpen(!qaimelerMenuOpen)
                          setKassaMenuOpen(false)
                          setCarilerMenuOpen(false)
                        } else if (item.path === '/kassa') {
                          setKassaMenuOpen(!kassaMenuOpen)
                          setQaimelerMenuOpen(false)
                          setCarilerMenuOpen(false)
                        } else if (item.path === '/cariler') {
                          setCarilerMenuOpen(!carilerMenuOpen)
                          setQaimelerMenuOpen(false)
                          setKassaMenuOpen(false)
                        }
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.5rem',
                        color: isActive ? '#1976d2' : '#666',
                        background: 'transparent',
                        border: 'none',
                        fontSize: '0.75rem',
                        minWidth: '44px',
                        minHeight: '44px',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                      <span style={{ fontSize: '0.7rem', textAlign: 'center' }}>
                        {item.label}
                      </span>
                    </button>
                    
                    {/* Qaimələr Submenu */}
                    {item.path === '/qaimeler' && qaimelerMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          bottom: '60px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'white',
                          borderRadius: '8px',
                          boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
                          minWidth: '200px',
                          zIndex: 1002,
                          border: '1px solid #e0e0e0',
                          pointerEvents: 'auto',
                        }}
                      >
                        {item.submenu?.map((subItem) => {
                          const isSubActive = location.pathname === subItem.path
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              onClick={(e) => {
                                e.stopPropagation()
                                setQaimelerMenuOpen(false)
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '1rem',
                                color: isSubActive ? '#1976d2' : '#333',
                                textDecoration: 'none',
                                borderBottom: '1px solid #eee',
                                background: isSubActive ? '#e3f2fd' : 'transparent',
                                fontWeight: isSubActive ? 'bold' : 'normal',
                                minHeight: '44px',
                                cursor: 'pointer',
                              }}
                            >
                              <span style={{ fontSize: '1.25rem' }}>{subItem.icon}</span>
                              <span>{subItem.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                    
                    {/* Kassa Submenu */}
                    {item.path === '/kassa' && kassaMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          bottom: '60px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'white',
                          borderRadius: '8px',
                          boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
                          minWidth: '200px',
                          zIndex: 1002,
                          border: '1px solid #e0e0e0',
                          pointerEvents: 'auto',
                        }}
                      >
                        {item.submenu?.map((subItem) => {
                          const isSubActive = location.pathname === subItem.path
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              onClick={(e) => {
                                e.stopPropagation()
                                setKassaMenuOpen(false)
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '1rem',
                                color: isSubActive ? '#1976d2' : '#333',
                                textDecoration: 'none',
                                borderBottom: '1px solid #eee',
                                background: isSubActive ? '#e3f2fd' : 'transparent',
                                fontWeight: isSubActive ? 'bold' : 'normal',
                                minHeight: '44px',
                                cursor: 'pointer',
                              }}
                            >
                              <span style={{ fontSize: '1.25rem' }}>{subItem.icon}</span>
                              <span>{subItem.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                    {/* Carilər Submenu */}
                    {item.path === '/cariler' && carilerMenuOpen && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          bottom: '60px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'white',
                          borderRadius: '8px',
                          boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
                          minWidth: '200px',
                          zIndex: 1002,
                          border: '1px solid #e0e0e0',
                          pointerEvents: 'auto',
                        }}
                      >
                        {item.submenu?.map((subItem) => {
                          const isSubActive = location.pathname === subItem.path
                          return (
                            <Link
                              key={subItem.path}
                              to={subItem.path}
                              onClick={(e) => {
                                e.stopPropagation()
                                setCarilerMenuOpen(false)
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '1rem',
                                color: isSubActive ? '#1976d2' : '#333',
                                textDecoration: 'none',
                                borderBottom: '1px solid #eee',
                                background: isSubActive ? '#e3f2fd' : 'transparent',
                                fontWeight: isSubActive ? 'bold' : 'normal',
                                minHeight: '44px',
                                cursor: 'pointer',
                              }}
                            >
                              <span style={{ fontSize: '1.25rem' }}>{subItem.icon}</span>
                              <span>{subItem.label}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }
              
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={(e) => {
                    e.stopPropagation()
                    // Submenu-ləri bağla
                    setQaimelerMenuOpen(false)
                    setKassaMenuOpen(false)
                    setCarilerMenuOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: '0.5rem',
                    color: isActive ? '#1976d2' : '#666',
                    textDecoration: 'none',
                    fontSize: '0.75rem',
                    minWidth: '44px',
                    minHeight: '44px',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    zIndex: 1003,
                    pointerEvents: 'auto',
                  }}
                >
                  <span style={{ fontSize: '1.5rem' }}>{item.icon}</span>
                  <span style={{ fontSize: '0.7rem', textAlign: 'center' }}>
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </nav>
          
          {/* Submenu-ləri bağla əgər kənara kliklənərsə */}
          {(qaimelerMenuOpen || kassaMenuOpen || carilerMenuOpen) && (
            <div
              onClick={(e) => {
                // Yalnız overlay-ə kliklənəndə submenu-ləri bağla, Link-lərə kliklənəndə yox
                if (e.target === e.currentTarget) {
                  setQaimelerMenuOpen(false)
                  setKassaMenuOpen(false)
                  setCarilerMenuOpen(false)
                }
              }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: '60px',
                zIndex: 1000,
                background: 'transparent',
                pointerEvents: 'auto',
              }}
            />
          )}
        </>
      )}
      
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

// Navbar gesture ayarlarını export et ki, Alici.tsx-də istifadə edə bilsin
export const useNavbarGestureSettings = () => {
  const [topNavbarGestureEnabled, setTopNavbarGestureEnabled] = useState(() => {
    const saved = localStorage.getItem('topNavbarGestureEnabled')
    return saved === 'true'
  })
  const [bottomNavbarGestureEnabled, setBottomNavbarGestureEnabled] = useState(() => {
    const saved = localStorage.getItem('bottomNavbarGestureEnabled')
    return saved === 'true'
  })
  
  useEffect(() => {
    localStorage.setItem('topNavbarGestureEnabled', String(topNavbarGestureEnabled))
  }, [topNavbarGestureEnabled])
  
  useEffect(() => {
    localStorage.setItem('bottomNavbarGestureEnabled', String(bottomNavbarGestureEnabled))
  }, [bottomNavbarGestureEnabled])
  
  return {
    topNavbarGestureEnabled,
    setTopNavbarGestureEnabled,
    bottomNavbarGestureEnabled,
    setBottomNavbarGestureEnabled,
  }
}

