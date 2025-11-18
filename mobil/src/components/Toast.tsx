import { useEffect } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type = 'info', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const colors = {
    success: { bg: '#4caf50', icon: '✅' },
    error: { bg: '#d32f2f', icon: '❌' },
    info: { bg: '#1976d2', icon: 'ℹ️' },
  }

  const color = colors[type]

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: color.bg,
        color: 'white',
        padding: '0.75rem 1.5rem',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.875rem',
        fontWeight: '500',
        maxWidth: '90%',
        cursor: 'pointer',
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      <span style={{ fontSize: '1.25rem' }}>{color.icon}</span>
      <span>{message}</span>
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

