import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useWindowStore } from '../store/windowStore'

// Route adları
const routeNames: Record<string, string> = {
  '/': 'Ana Səhifə',
  '/products': 'Məhsullar',
  '/hesablar': 'Hesablar',
  '/anbar': 'Anbar',
  '/qaimeler/alis': 'Alış Qaimələri',
  '/qaimeler/satis': 'Satış Qaimələri',
  '/kassa/medaxil': 'Kassa Medaxil',
  '/kassa/mexaric': 'Kassa Mexaric',
  '/musteriler/alici': 'Alıcılar',
  '/musteriler/satici': 'Satıcılar',
  '/profile': 'Profil',
}

// Taskbar komponenti
function Taskbar({ openRoutes, setOpenRoutes, location, navigate }: { 
  openRoutes: Set<string>
  setOpenRoutes: React.Dispatch<React.SetStateAction<Set<string>>>
  location: ReturnType<typeof useLocation>
  navigate: ReturnType<typeof useNavigate>
}) {
  const { windows, activateWindow, removeWindow, tileWindows } = useWindowStore()
  
  // Bütün pəncərələri birləşdir: routes + modals
  const allTaskbarItems: Array<{ id: string, title: string, icon: string, isActive: boolean, type: 'route' | 'modal', route?: string, onClick: () => void, onClose: () => void }> = []
  
  // Routes əlavə et
  Array.from(openRoutes).forEach((route) => {
    const isActive = location.pathname === route
    const routeName = routeNames[route] || route
    
    const getIcon = () => {
      if (route.includes('satis')) return '📄'
      if (route.includes('alis')) return '📋'
      if (route.includes('anbar')) return '📦'
      if (route.includes('hesablar')) return '💰'
      if (route.includes('kassa')) return '💵'
      if (route.includes('musteriler')) return '👥'
      if (route === '/') return '🏠'
      if (route === '/products') return '🛍️'
      if (route === '/profile') return '👤'
      return '📄'
    }
    
    allTaskbarItems.push({
      id: `route-${route}`,
      title: routeName,
      icon: getIcon(),
      isActive,
      type: 'route',
      route,
      onClick: () => navigate(route),
      onClose: () => {
        if (openRoutes.size > 1 && route !== location.pathname) {
          setOpenRoutes(prev => {
            const newSet = new Set(prev)
            newSet.delete(route)
            return newSet
          })
        }
      }
    })
  })
  
  // Modalları əlavə et (həm görünən, həm də minimize edilmiş)
  Array.from(windows.values())
    .filter(w => w.type === 'modal') // isVisible yoxlamasını sil - minimize edilmişləri də göstər
    .sort((a, b) => b.zIndex - a.zIndex)
    .forEach((window) => {
      const visibleWindows = Array.from(windows.values()).filter(w => w.isVisible && !w.isMinimized)
      const maxZIndex = visibleWindows.length > 0 
        ? Math.max(...visibleWindows.map(w => w.zIndex))
        : 0
      const isActive = window.isVisible && !window.isMinimized && window.zIndex === maxZIndex
      
      const getIcon = () => {
        switch (window.modalType) {
          case 'qaime':
          case 'invoice-edit':
            return '📄'
          case 'customer':
            return '👤'
          case 'supplier':
            return '🏢'
          case 'product':
            return '📦'
          case 'settings':
            return '⚙️'
          default:
            return '📄'
        }
      }
      
      allTaskbarItems.push({
        id: window.id,
        title: window.title + (window.isMinimized ? ' (minimize)' : ''),
        icon: getIcon(),
        isActive,
        type: 'modal',
        onClick: () => {
          if (window.isMinimized) {
            // Restore et
            const store = useWindowStore.getState()
            store.restoreWindow(window.id)
          } else {
            // Aktivləşdir
            activateWindow(window.id)
          }
        },
        onClose: () => removeWindow(window.id)
      })
    })
  
  // Z-index-ə görə sırala (modallar üstə)
  allTaskbarItems.sort((a, b) => {
    if (a.type === 'modal' && b.type === 'route') return -1
    if (a.type === 'route' && b.type === 'modal') return 1
    if (a.type === 'modal' && b.type === 'modal') {
      const aWindow = windows.get(a.id)
      const bWindow = windows.get(b.id)
      return (bWindow?.zIndex || 0) - (aWindow?.zIndex || 0)
    }
    return 0
  })
  
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '50px',
        background: 'linear-gradient(to top, #2c3e50, #34495e)',
        borderTop: '2px solid #1a252f',
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        gap: '5px',
        zIndex: 10000,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.3)',
        overflowX: 'auto',
      }}
    >
      {allTaskbarItems.map((item) => (
        <div
          key={item.id}
          onClick={item.onClick}
          onContextMenu={(e) => {
            e.preventDefault()
            item.onClose()
          }}
          style={{
            padding: '8px 16px',
            background: item.isActive 
              ? 'linear-gradient(to top, #3498db, #2980b9)' 
              : 'linear-gradient(to top, #34495e, #2c3e50)',
            color: 'white',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: item.isActive ? 'bold' : 'normal',
            borderTop: item.isActive ? '2px solid #3498db' : '2px solid transparent',
            borderLeft: item.isActive ? '2px solid #3498db' : '2px solid transparent',
            borderRight: item.isActive ? '2px solid #3498db' : '2px solid transparent',
            borderBottom: 'none',
            minWidth: '120px',
            maxWidth: '200px',
            textAlign: 'center',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!item.isActive) {
              e.currentTarget.style.background = 'linear-gradient(to top, #3d566e, #34495e)'
            }
          }}
          onMouseLeave={(e) => {
            if (!item.isActive) {
              e.currentTarget.style.background = 'linear-gradient(to top, #34495e, #2c3e50)'
            }
          }}
        >
          <span>{item.icon}</span>
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {item.title}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, customer, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const [openRoutes, setOpenRoutes] = useState<Set<string>>(new Set())
  
  // Cari route-u açıq route-lara əlavə et
  useEffect(() => {
    if (isAuthenticated && location.pathname !== '/login' && location.pathname !== '/register') {
      setOpenRoutes(prev => new Set(prev).add(location.pathname))
    }
  }, [location.pathname, isAuthenticated])

  // Dropdown-ları bağla əgər nav-dan kənara kliklənərsə
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveDropdown(null)
      }
    }

    if (activeDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [activeDropdown])

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const displayName = customer?.name || user?.email || 'İstifadəçi'

  const toggleDropdown = (name: string) => {
    setActiveDropdown(activeDropdown === name ? null : name)
  }

  return (
    <div>
      <nav 
        ref={navRef}
        style={{
          background: '#333',
          color: 'white',
          padding: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 1000
        }}
      >
        <Link to="/" style={{ color: 'white', textDecoration: 'none', fontSize: '1.5rem', fontWeight: 'bold' }}>
          MobilSayt
        </Link>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', position: 'relative' }}>
          {isAuthenticated ? (
            <>
              {/* Qaimələr Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => toggleDropdown('qaimeler')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    fontSize: '1rem'
                  }}
                >
                  Qaimələr ▼
                </button>
                {activeDropdown === 'qaimeler' && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    background: '#444',
                    minWidth: '150px',
                    marginTop: '0.5rem',
                    borderRadius: '4px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    zIndex: 1000
                  }}>
                    <Link
                      to="/qaimeler/alis"
                      onClick={() => setActiveDropdown(null)}
                      style={{
                        display: 'block',
                        color: 'white',
                        textDecoration: 'none',
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid #555'
                      }}
                    >
                      Alış Qaimələri
                    </Link>
                    <Link
                      to="/qaimeler/satis"
                      onClick={() => setActiveDropdown(null)}
                      style={{
                        display: 'block',
                        color: 'white',
                        textDecoration: 'none',
                        padding: '0.75rem 1rem'
                      }}
                    >
                      Satış Qaimələri
                    </Link>
                  </div>
                )}
              </div>

              {/* Hesablar */}
              <Link to="/hesablar" style={{ color: 'white', textDecoration: 'none' }}>
                Hesablar
              </Link>

              {/* Anbar */}
              <Link to="/anbar" style={{ color: 'white', textDecoration: 'none' }}>
                Anbar
              </Link>

              {/* Pəncərələri yan-yana gətir */}
              <button
                onClick={() => {
                  const store = useWindowStore.getState()
                  const visibleWindows = Array.from(store.windows.values())
                    .filter(w => w.type === 'modal' && w.isVisible && !w.isMinimized)
                    .map(w => w.id)
                  
                  if (visibleWindows.length > 0) {
                    store.tileWindows(visibleWindows)
                  }
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  fontSize: '1rem'
                }}
                title="Pəncərələri yan-yana gətir"
              >
                ⚏ Yan-yana
              </button>

              {/* Kassa Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => toggleDropdown('kassa')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    fontSize: '1rem'
                  }}
                >
                  Kassa ▼
                </button>
                {activeDropdown === 'kassa' && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    background: '#444',
                    minWidth: '150px',
                    marginTop: '0.5rem',
                    borderRadius: '4px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    zIndex: 1000
                  }}>
                    <Link
                      to="/kassa/medaxil"
                      onClick={() => setActiveDropdown(null)}
                      style={{
                        display: 'block',
                        color: 'white',
                        textDecoration: 'none',
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid #555'
                      }}
                    >
                      Medaxil
                    </Link>
                    <Link
                      to="/kassa/mexaric"
                      onClick={() => setActiveDropdown(null)}
                      style={{
                        display: 'block',
                        color: 'white',
                        textDecoration: 'none',
                        padding: '0.75rem 1rem'
                      }}
                    >
                      Mexaric
                    </Link>
                  </div>
                )}
              </div>

              {/* Müştərilər Dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => toggleDropdown('musteriler')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    fontSize: '1rem'
                  }}
                >
                  Müştərilər ▼
                </button>
                {activeDropdown === 'musteriler' && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    background: '#444',
                    minWidth: '150px',
                    marginTop: '0.5rem',
                    borderRadius: '4px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                    zIndex: 1000
                  }}>
                    <Link
                      to="/musteriler/alici"
                      onClick={() => setActiveDropdown(null)}
                      style={{
                        display: 'block',
                        color: 'white',
                        textDecoration: 'none',
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid #555'
                      }}
                    >
                      Alıcılar
                    </Link>
                    <Link
                      to="/musteriler/satici"
                      onClick={() => setActiveDropdown(null)}
                      style={{
                        display: 'block',
                        color: 'white',
                        textDecoration: 'none',
                        padding: '0.75rem 1rem'
                      }}
                    >
                      Satıcılar
                    </Link>
                  </div>
                )}
              </div>

              <span>{displayName}</span>
              <Link to="/profile" style={{ color: 'white', textDecoration: 'none' }}>
                Profil
              </Link>
              <button onClick={handleLogout} style={{
                background: '#ff4444',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer'
              }}>
                Çıxış
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ color: 'white', textDecoration: 'none' }}>
                Giriş
              </Link>
              <Link to="/register" style={{ color: 'white', textDecoration: 'none' }}>
                Qeydiyyat
              </Link>
            </>
          )}
        </div>
      </nav>
      <main style={{ minHeight: 'calc(100vh - 80px)', paddingBottom: '50px' }}>
        {children}
      </main>
      
      {/* Ümumi Taskbar - Bütün açıq səhifələr VƏ modallar */}
      {isAuthenticated && <Taskbar openRoutes={openRoutes} setOpenRoutes={setOpenRoutes} location={location} navigate={navigate} />}
    </div>
  )
}
