import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { clientLog } from '../services/api'

/**
 * Şəkildən barkod / QR oxuma helper-i.
 * Faylı Html5Qrcode.scanFile ilə oxuyur və tapdığı kodu qaytarır.
 */
export async function scanBarcodeFromImage(file: File): Promise<string> {
  const containerId = 'mobile-barcode-image-reader'

  // Gizli container yarat (əgər yoxdursa)
  let container = document.getElementById(containerId)
  if (!container) {
    container = document.createElement('div')
    container.id = containerId
    container.style.display = 'none'
    document.body.appendChild(container)
  }

  const html5QrCode = new Html5Qrcode(containerId, {
    // QR və ən çox istifadə olunan barkod formatlarını dəstəklə
    formatsToSupport: [
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
    ],
  })

  try {
    const decodedText = await html5QrCode.scanFile(file, false)
    return decodedText
  } catch (err: any) {
    console.error('Şəkildən barkod oxunarkən xəta:', err)
    clientLog('error', 'Şəkildən barkod oxunarkən xəta', {
      message: err?.message,
      name: err?.name,
    })
    throw err
  } finally {
    try {
      await html5QrCode.clear()
    } catch {
      // ignore
    }

    const el = document.getElementById(containerId)
    if (el && el.parentElement) {
      el.parentElement.removeChild(el)
    }
  }
}


