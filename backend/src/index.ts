import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import authRoutes from './routes/authRoutes'
import productRoutes from './routes/productRoutes'
import orderRoutes from './routes/orderRoutes'
import userRoutes from './routes/userRoutes'
import categoryRoutes from './routes/categoryRoutes'
import customerRoutes from './routes/customerRoutes'
import customerFolderRoutes from './routes/customerFolderRoutes'
import supplierRoutes from './routes/supplierRoutes'
import supplierFolderRoutes from './routes/supplierFolderRoutes'
import purchaseInvoiceRoutes from './routes/purchaseInvoiceRoutes'
import testRoutes from './routes/testRoutes'

dotenv.config()

const requiredEnvVars = ['JWT_SECRET']
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ Environment dəyişəni çatışmır: ${envVar}`)
    process.exit(1)
  }
})

const app = express()
const PORT = Number(process.env.PORT) || 5000

// CORS konfiqurasiyası
const allowedOrigins = [
  // Lokal inkişaf mühiti
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
]

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Origin yoxdursa (məsələn, Postman, server-server request), icazə ver
    if (!origin) {
      return callback(null, true)
    }

    // Whitelist yoxlaması
    const isWhitelisted = allowedOrigins.includes(origin)

    if (isWhitelisted) {
      console.log('✅ [CORS] Origin icazəlidir:', origin)
      return callback(null, true)
    }

    // Development mühitində bütün origin-lərə icazə ver (debug üçün)
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [CORS] Development mühiti - bütün origin-lərə icazə verilir:', origin)
      return callback(null, true)
    }

    console.error('❌ CORS bloklandı. Origin icazəli deyil:', origin)
    return callback(new Error('CORS policy: Origin not allowed'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 saat
}

app.use(cors(corsOptions))

// Preflight request-ləri handle et (eyni konfiqurasiya ilə)
app.options('*', cors(corsOptions))

app.use(express.json())

app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`)
  })
  next()
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend API is running' })
})

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/users', userRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/customers', customerRoutes)
app.use('/api/customer-folders', customerFolderRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/supplier-folders', supplierFolderRoutes)
app.use('/api/purchase-invoices', purchaseInvoiceRoutes)
app.use('/api/test', testRoutes)

// =========================
// Frontend static faylları
// =========================

// Build olunmuş frontend-lərin yolları:
// __dirname -> backend/dist
const rootDir = path.resolve(__dirname, '..', '..')
const webDistPath = path.join(rootDir, 'web', 'dist')
const mobilDistPath = path.join(rootDir, 'mobil', 'dist')

// Web və Mobil build-ləri static kimi serve et
app.use('/web', express.static(webDistPath))
app.use('/mobil', express.static(mobilDistPath))

// Eyni linkdən (/) giriş zamanı cihaz növünə görə yönləndirmə
app.get('/', (req, res) => {
  const userAgent = req.headers['user-agent'] || ''

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    userAgent,
  )

  const indexFile = isMobile
    ? path.join(mobilDistPath, 'index.html')
    : path.join(webDistPath, 'index.html')

  res.sendFile(indexFile)
})

// React Router üçün fallback-lar (PC və Mobil üçün ayrıca)
app.get('/web/*', (req, res) => {
  res.sendFile(path.join(webDistPath, 'index.html'))
})

app.get('/mobil/*', (req, res) => {
  res.sendFile(path.join(mobilDistPath, 'index.html'))
})

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route tapılmadı' })
})

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ [ERROR] Global error handler:')
  console.error('❌ [ERROR] Error message:', err.message)
  console.error('❌ [ERROR] Error code:', err.code)
  console.error('❌ [ERROR] Error stack:', err.stack)
  console.error('❌ [ERROR] Request path:', req.path)
  console.error('❌ [ERROR] Request method:', req.method)
  console.error('❌ [ERROR] Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2))
  
  res.status(500).json({ 
    message: 'Server xətası',
    error: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  })
})

// Bütün interfeyslərdə dinlə (telefondan qoşulmaq üçün)
const HOST = process.env.HOST || '0.0.0.0'
const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`)
  console.log(`📝 API endpoints:`)
  console.log(`   - POST /api/auth/register`)
  console.log(`   - POST /api/auth/login`)
  console.log(`   - GET  /api/products`)
  console.log(`   - POST /api/products`)
  console.log(`   - GET  /api/orders`)
  console.log(`   - POST /api/orders`)
  console.log(`   - GET  /api/users/profile`)
})

// Graceful shutdown for ts-node-dev hot reload
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM signal received: closing HTTP server')
  server.close(() => {
    console.log('✅ HTTP server closed')
  })
})

process.on('SIGINT', () => {
  console.log('⚠️  SIGINT signal received: closing HTTP server')
  server.close(() => {
    console.log('✅ HTTP server closed')
    process.exit(0)
  })
})

// Handle ts-node-dev restart
if (process.env.NODE_ENV !== 'production') {
  process.once('SIGUSR2', () => {
    console.log('⚠️  SIGUSR2 signal received: closing HTTP server for restart')
    server.close(() => {
      console.log('✅ HTTP server closed, restarting...')
      process.kill(process.pid, 'SIGUSR2')
    })
  })
}
