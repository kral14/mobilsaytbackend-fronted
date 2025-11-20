import { useEffect, useRef, useState } from 'react'
import { scanBarcodeFromImage } from '../utils/barcodeImageScanner'

interface BarcodeImageCropperProps {
  open: boolean
  file: File | null
  onClose: () => void
  onDetected: (code: string) => void
}

const DEFAULT_FRAME_SIZE = 320
const MIN_FRAME_SIZE = 200
const MAX_FRAME_SIZE = 380

export default function BarcodeImageCropper({ open, file, onClose, onDetected }: BarcodeImageCropperProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [baseScale, setBaseScale] = useState(1)
  const [frameSize, setFrameSize] = useState(DEFAULT_FRAME_SIZE)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragState = useRef<{
    active: boolean
    startX: number
    startY: number
    startOffsetX: number
    startOffsetY: number
  }>({ active: false, startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 })
  const pinchState = useRef<{
    active: boolean
    startDistance: number
    startScale: number
  }>({ active: false, startDistance: 0, startScale: 1 })
  const resizeState = useRef<{
    active: boolean
    startX: number
    startSize: number
  }>({ active: false, startX: 0, startSize: DEFAULT_FRAME_SIZE })

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!file) {
      setImageUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setFrameSize(DEFAULT_FRAME_SIZE)

    // Şəkli yükləyib, çərçivəyə sığacaq bazal scale dəyərini hesabla
    const img = new Image()
    img.src = url
    img.onload = () => {
      const fitScale = Math.min(DEFAULT_FRAME_SIZE / img.width, DEFAULT_FRAME_SIZE / img.height)
      setBaseScale(fitScale > 0 ? fitScale : 1)
    }

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [file])

  if (!open || !file || !imageUrl) {
    return null
  }

  const handleStartDrag = (clientX: number, clientY: number) => {
    dragState.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    }
  }

  const handleMoveDrag = (clientX: number, clientY: number) => {
    if (!dragState.current.active) return
    const dx = clientX - dragState.current.startX
    const dy = clientY - dragState.current.startY
    setOffset({
      x: dragState.current.startOffsetX + dx,
      y: dragState.current.startOffsetY + dy,
    })
  }

  const stopDrag = () => {
    dragState.current.active = false
    resizeState.current.active = false
    pinchState.current.active = false
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    handleStartDrag(e.clientX, e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    e.preventDefault()
    handleMoveDrag(e.clientX, e.clientY)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      pinchState.current.active = false
      const t = e.touches[0]
      handleStartDrag(t.clientX, t.clientY)
    } else if (e.touches.length === 2) {
      // Pinch zoom
      dragState.current.active = false
      const [t1, t2] = [e.touches[0], e.touches[1]]
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      pinchState.current = {
        active: true,
        startDistance: dist,
        startScale: scale,
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchState.current.active) {
      const [t1, t2] = [e.touches[0], e.touches[1]]
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const ratio = dist / (pinchState.current.startDistance || 1)
      const nextScale = Math.min(3, Math.max(0.5, pinchState.current.startScale * ratio))
      setScale(nextScale)
    } else if (e.touches.length === 1 && !pinchState.current.active) {
      const t = e.touches[0]
      handleMoveDrag(t.clientX, t.clientY)
    }
  }

  const handleZoomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value)
    setScale(value)
  }

  const handleScan = async () => {
    if (!file || !imageUrl) return
    setLoading(true)
    try {
      // Şəkli yüklə
      const img = new Image()
      img.src = imageUrl

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Şəkil yüklənə bilmədi'))
      })

      const canvas = document.createElement('canvas')
      canvas.width = frameSize
      canvas.height = frameSize
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas dəstəklənmir')

      ctx.fillStyle = 'black'
      ctx.fillRect(0, 0, frameSize, frameSize)

      const computedBase =
        baseScale && baseScale > 0 ? baseScale : Math.min(frameSize / img.width, frameSize / img.height)
      const s = computedBase * scale

      // Frame görünüşünü canvas-da təkrarlayırıq
      ctx.setTransform(s, 0, 0, s, frameSize / 2 + offset.x, frameSize / 2 + offset.y)
      ctx.translate(-img.width / 2, -img.height / 2)
      ctx.drawImage(img, 0, 0)

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error('Canvas boşdur'))
        }, 'image/png')
      })

      const croppedFile = new File([blob], 'crop.png', { type: 'image/png' })

      let code: string
      try {
        // Əvvəlcə crop olunmuş hissədən oxumağa cəhd et
        code = await scanBarcodeFromImage(croppedFile)
      } catch (err: any) {
        // Əgər kod tapılmadısa (NotFoundException), bütün şəkli fallback kimi yoxla
        if (err?.name === 'NotFoundException' || String(err?.message).includes('No MultiFormat Readers')) {
          code = await scanBarcodeFromImage(file)
        } else {
          throw err
        }
      }

      onDetected(code)
      onClose()
    } catch (err: any) {
      alert('Şəkildən barkod oxunarkən xəta: ' + (err?.message || 'Naməlum xəta'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 12000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1rem',
          width: '100%',
          maxWidth: 460,
        }}
      >
        <h3 style={{ margin: '0 0 0.5rem 0', textAlign: 'center' }}>Şəkildən barkod oxu</h3>
        <p style={{ fontSize: '0.85rem', color: '#555', marginBottom: '0.75rem', textAlign: 'center' }}>
          Şəkli bar­kod çərçivəyə gətirmək üçün barmağınızla sürüşdürün, aşağıdakı slider ilə zoom edin.
        </p>

        <div
          style={{
            width: frameSize,
            height: frameSize,
            margin: '0 auto 0.75rem auto',
            borderRadius: 8,
            border: '2px solid #1976d2',
            overflow: 'hidden',
            position: 'relative',
            touchAction: 'none',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={stopDrag}
        >
          <img
            src={imageUrl}
            alt="Barkod şəkli"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${baseScale * scale})`,
              transformOrigin: 'center center',
              maxWidth: 'none',
            }}
          />

          {/* Resize handle (aşağı sağ künc) */}
          <div
            onMouseDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              resizeState.current = {
                active: true,
                startX: e.clientX,
                startSize: frameSize,
              }
            }}
            onTouchStart={(e) => {
              if (e.touches.length === 1) {
                const t = e.touches[0]
                e.stopPropagation()
                resizeState.current = {
                  active: true,
                  startX: t.clientX,
                  startSize: frameSize,
                }
              }
            }}
            onTouchMove={(e) => {
              if (!resizeState.current.active || e.touches.length !== 1) return
              const t = e.touches[0]
              const dx = t.clientX - resizeState.current.startX
              const next = Math.min(
                MAX_FRAME_SIZE,
                Math.max(MIN_FRAME_SIZE, resizeState.current.startSize + dx)
              )
              setFrameSize(next)
            }}
            style={{
              position: 'absolute',
              right: 4,
              bottom: 4,
              width: 22,
              height: 22,
              borderRadius: 11,
              background: 'rgba(25, 118, 210, 0.9)',
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 12,
              cursor: 'nwse-resize',
              touchAction: 'none',
            }}
          >
            ⇲
          </div>
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <input
            type="range"
            min={0.5}
            max={3}
            step={0.1}
            value={scale}
            onChange={handleZoomChange}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '0.6rem',
              background: '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '0.95rem',
            }}
          >
            Ləğv et
          </button>
          <button
            type="button"
            onClick={handleScan}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.6rem',
              background: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '0.95rem',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Oxunur...' : 'Oxu'}
          </button>
        </div>
      </div>
    </div>
  )
}


