import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: string
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('🔐 [AUTH] Middleware çağırıldı:', {
      method: req.method,
      path: req.originalUrl,
      hasAuthorizationHeader: !!req.headers.authorization,
      ip: req.ip,
    })

    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      console.warn('⚠️ [AUTH] Token təmin edilməyib:', {
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
      })
      return res.status(401).json({ message: 'Token təmin edilməyib' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { userId: string }
    console.log('✅ [AUTH] Token uğurla doğrulandı:', {
      userId: decoded.userId,
      path: req.originalUrl,
    })
    req.userId = decoded.userId
    next()
  } catch (error) {
    console.error('❌ [AUTH] Token doğrulama xətası:', {
      message: (error as any).message,
      name: (error as any).name,
      path: req.originalUrl,
      ip: req.ip,
    })
    return res.status(401).json({ message: 'Yanlış token' })
  }
}

