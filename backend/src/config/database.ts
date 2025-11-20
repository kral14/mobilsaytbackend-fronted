import { PrismaClient } from '@prisma/client'

// Singleton pattern - yalnız bir Prisma Client instance
let prisma: PrismaClient

declare global {
  var __prisma: PrismaClient | undefined
}

const isProduction = process.env.NODE_ENV === 'production'

const logConfig =
  isProduction
    ? [
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ]
    : [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ]

if (isProduction) {
  prisma = new PrismaClient({ log: logConfig as any })
} else {
  // Development-də global variable-dan istifadə et (hot reload üçün)
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({ log: logConfig as any })
  }
  prisma = global.__prisma
}

// Query log listener (yalnız development)
const enableQueryLogging = !isProduction
if (enableQueryLogging && !(prisma as any)._queryListenerAdded) {
  prisma.$on('query' as never, (e: any) => {
    console.log('🔍 [PRISMA QUERY]', e.query)
    console.log('🔍 [PRISMA PARAMS]', e.params)
    console.log('🔍 [PRISMA DURATION]', e.duration + 'ms')
  })
  ;(prisma as any)._queryListenerAdded = true
}

// Connection test (yalnız bir dəfə)
if (!(prisma as any)._connectionTested) {
  prisma.$connect()
    .then(() => {
      console.log('✅ [DATABASE] Prisma Client verilənlər bazasına qoşuldu')
    })
    .catch((err) => {
      console.error('❌ [DATABASE] Prisma Client qoşulma xətası:', err)
    })
  ;(prisma as any)._connectionTested = true
}

export default prisma

