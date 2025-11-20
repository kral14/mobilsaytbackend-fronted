import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { execSync } from 'child_process'
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

// Production-də Prisma migration-ları avtomatik işə sal
if (process.env.NODE_ENV === 'production') {
  try {
    console.log('🔄 [PRISMA] Database schema sinxronizasiya edilir...')
    execSync('npx prisma db push --accept-data-loss', { 
      stdio: 'inherit',
      cwd: __dirname + '/..'
    })
    console.log('✅ [PRISMA] Database schema sinxronizasiya olundu')
  } catch (error) {
    console.error('⚠️  [PRISMA] Database sinxronizasiya xətası:', error)
    // Xəta olsa belə serveri başlat (migration-lar sonra manual işə salına bilər)
  }
}

const app = express()
const PORT = Number(process.env.PORT) || 5000

// CORS konfiqurasiyası
const allowedOrigins = [
  // Render frontend domenləri
  'https://mobilsayt-web.onrender.com',
  'https://mobilsayt-frontend.onrender.com',
  'https://mobilsayt-mobil.onrender.com',
  // Local development
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

    // Əsas whitelist yoxlaması
    const isWhitelisted = allowedOrigins.includes(origin)

    // Əlavə: hər ehtimala qarşı bütün `mobilsayt-*.onrender.com` domenlərini icazə ver
    let isRenderMobilsayt = false
    try {
      const url = new URL(origin)
      isRenderMobilsayt =
        url.hostname.endsWith('.onrender.com') && url.hostname.startsWith('mobilsayt-')
    } catch {
      // URL parse alınmasa, nəzərə alma
    }

    if (isWhitelisted || isRenderMobilsayt) {
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

// Gələn bütün request-lər üçün detallı log middleware-i
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const start = Date.now()
  const { method, originalUrl, headers, query, body } = req

  // Həssas məlumatları maskala
  const safeHeaders: any = { ...headers }
  if (safeHeaders.authorization) {
    safeHeaders.authorization = '***redacted***'
  }

  const safeBody: any =
    body && typeof body === 'object'
      ? { ...body }
      : body

  if (safeBody && typeof safeBody === 'object') {
    if (safeBody.password) safeBody.password = '***redacted***'
    if (safeBody.oldPassword) safeBody.oldPassword = '***redacted***'
    if (safeBody.newPassword) safeBody.newPassword = '***redacted***'
  }

  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress

  console.log(
    '📥 [REQUEST]',
    JSON.stringify(
      {
        method,
        url: originalUrl,
        query,
        body: safeBody,
        headers: {
          origin: headers.origin,
          host: headers.host,
          'user-agent': headers['user-agent'],
          referer: headers.referer || headers.referrer,
        },
        ip: clientIp,
      },
      null,
      2,
    ),
  )

  res.on('finish', () => {
    const duration = Date.now() - start
    console.log(
      `📤 [RESPONSE] ${method} ${originalUrl} -> ${res.statusCode} (${duration}ms)`,
    )
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
