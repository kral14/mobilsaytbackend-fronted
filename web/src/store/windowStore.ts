import { create } from 'zustand'

export interface WindowInfo {
  id: string
  title: string
  type: 'route' | 'modal'
  modalType?: 'qaime' | 'customer' | 'product' | 'settings' | 'invoice-edit' | 'supplier'
  route?: string // Route üçün
  isVisible: boolean
  isMinimized: boolean // Minimize statusu
  zIndex: number
  position?: { x: number, y: number } // Pəncərə mövqeyi
  size?: { width: number, height: number } // Pəncərə ölçüsü
  isMaximized?: boolean // Maximize statusu
  onActivate: () => void
  onClose: () => void
  onRestore?: () => void // Restore callback (minimize-dan geri qayıtmaq üçün)
}

interface WindowStore {
  windows: Map<string, WindowInfo>
  baseZIndex: number
  addWindow: (window: WindowInfo) => void
  removeWindow: (id: string) => void
  activateWindow: (id: string) => void
  updateWindow: (id: string, updates: Partial<WindowInfo>) => void
  incrementZIndex: () => number
  minimizeWindow: (id: string) => void
  restoreWindow: (id: string) => void
  tileWindows: (windowIds: string[]) => void
}

export const useWindowStore = create<WindowStore>((set, get) => ({
  windows: new Map(),
  baseZIndex: 1000,
  
  addWindow: (window) => {
    set((state) => {
      const newWindows = new Map(state.windows)
      const newZIndex = state.baseZIndex + 1
      newWindows.set(window.id, { 
        ...window, 
        zIndex: newZIndex,
        isMinimized: window.isMinimized ?? false,
        isMaximized: window.isMaximized ?? false
      })
      return {
        windows: newWindows,
        baseZIndex: newZIndex
      }
    })
  },
  
  removeWindow: (id) => {
    set((state) => {
      const newWindows = new Map(state.windows)
      // onClose callback-ini çağırmırıq, çünki o artıq removeWindow-u çağırır
      // Bu sonsuz döngü yaradır. onClose yalnız modal state-lərini təmizləmək üçündür
      newWindows.delete(id)
      return { windows: newWindows }
    })
  },
  
  activateWindow: (id) => {
    set((state) => {
      const newWindows = new Map(state.windows)
      const window = newWindows.get(id)
      if (window) {
        const newZIndex = state.baseZIndex + 1
        window.onActivate()
        // Əgər minimize edilmişdirsə, restore et
        if (window.isMinimized && window.onRestore) {
          window.onRestore()
        }
        newWindows.set(id, { 
          ...window, 
          zIndex: newZIndex, 
          isVisible: true,
          isMinimized: false // Restore et
        })
        return {
          windows: newWindows,
          baseZIndex: newZIndex
        }
      }
      return state
    })
  },
  
  // Pəncərələri yan-yana gətir
  tileWindows: (windowIds: string[]) => {
    set((state) => {
      const newWindows = new Map(state.windows)
      const visibleWindows = windowIds
        .map(id => newWindows.get(id))
        .filter(w => w && !w.isMinimized)
        .slice(0, 4) // Maksimum 4 pəncərə yan-yana
      
      if (visibleWindows.length === 0) return state
      
      const screenWidth = window.innerWidth
      const screenHeight = window.innerHeight - 100 // Taskbar üçün yer
      const cols = Math.ceil(Math.sqrt(visibleWindows.length))
      const rows = Math.ceil(visibleWindows.length / cols)
      const windowWidth = screenWidth / cols
      const windowHeight = screenHeight / rows
      
      visibleWindows.forEach((window, index) => {
        if (!window) return
        
        const col = index % cols
        const row = Math.floor(index / cols)
        const x = col * windowWidth
        const y = row * windowHeight
        
        newWindows.set(window.id, {
          ...window,
          position: { x, y },
          size: { width: windowWidth, height: windowHeight },
          isMaximized: false,
          zIndex: state.baseZIndex + index + 1
        })
      })
      
      return {
        windows: newWindows,
        baseZIndex: state.baseZIndex + visibleWindows.length
      }
    })
  },
  
  // Minimize et
  minimizeWindow: (id: string) => {
    set((state) => {
      const newWindows = new Map(state.windows)
      const window = newWindows.get(id)
      if (window) {
        newWindows.set(id, { ...window, isMinimized: true, isVisible: false })
      }
      return { windows: newWindows }
    })
  },
  
  // Restore et (minimize-dan geri qayıt)
  restoreWindow: (id: string) => {
    set((state) => {
      const newWindows = new Map(state.windows)
      const window = newWindows.get(id)
      if (window && window.isMinimized) {
        const newZIndex = state.baseZIndex + 1
        // Callback-i çağır
        if (window.onRestore) {
          window.onRestore()
        }
        // Store-da state-i yenilə
        newWindows.set(id, { 
          ...window, 
          isMinimized: false, 
          isVisible: true,
          zIndex: newZIndex
        })
        return {
          windows: newWindows,
          baseZIndex: newZIndex
        }
      }
      return state
    })
  },
  
  updateWindow: (id, updates) => {
    set((state) => {
      const newWindows = new Map(state.windows)
      const window = newWindows.get(id)
      if (window) {
        newWindows.set(id, { ...window, ...updates })
      }
      return { windows: newWindows }
    })
  },
  
  incrementZIndex: () => {
    const newZIndex = get().baseZIndex + 1
    set({ baseZIndex: newZIndex })
    return newZIndex
  }
}))

