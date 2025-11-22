import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
}

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  return secret
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      return res.status(401).json({ message: 'Token təmin edilməyib' })
    }

    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string }
    req.userId = decoded.userId
    next()
  } catch (error) {
    const isMissingSecret = (error as any)?.message?.includes('JWT_SECRET environment variable is required')

    if (isMissingSecret) {
      console.error('❌ [AUTH] JWT_SECRET tələb olunur, lakin təyin edilməyib')
      return res.status(500).json({ message: 'Server konfiqurasiyası düzgün deyil' })
    }

    return res.status(401).json({ message: 'Yanlış və ya müddəti bitmiş token' })
  }
}

