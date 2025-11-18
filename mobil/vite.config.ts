import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    // PWA plugin-i əlavə etmək istəsəniz: npm install -D vite-plugin-pwa
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   includeAssets: ['favicon.svg'],
    //   manifest: {
    //     name: 'MobilSayt',
    //     short_name: 'MobilSayt',
    //     description: 'Mobil üçün optimizasiya edilmiş alış-satış idarəetmə sistemi',
    //     theme_color: '#1976d2',
    //     background_color: '#ffffff',
    //     display: 'standalone',
    //     icons: [
    //       {
    //         src: '/favicon.svg',
    //         sizes: 'any',
    //         type: 'image/svg+xml'
    //       }
    //     ]
    //   }
    // })
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    host: '0.0.0.0', // Bütün interfeyslərdə dinlə (telefondan qoşulmaq üçün)
    port: 3001, // Default port 3001, amma 3000-dən də işləyə bilər
    strictPort: false,
    // HMR-ni telefon üçün söndür (invalid response xətasını qarşısını almaq üçün)
    hmr: false,
    cors: true, // CORS aktiv et
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: false // WebSocket-i söndür
      }
    }
  }
})

