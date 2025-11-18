import { PrismaClient } from '@prisma/client'

// Singleton pattern - yalnız bir Prisma Client instance
let prisma: PrismaClient

declare global {
  var __prisma: PrismaClient | undefined
}

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  })
} else {
  // Development-də global variable-dan istifadə et (hot reload üçün)
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    })
  }
  prisma = global.__prisma
}

// Query log listener (yalnız bir dəfə)
if (!(prisma as any)._queryListenerAdded) {
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

