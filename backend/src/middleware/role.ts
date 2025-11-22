import { Response, NextFunction } from 'express'
import { AuthRequest } from './auth'
import prisma from '../config/database'

// Role-based access control middleware
export const requireRole = (allowedRoles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        console.error('❌ [ROLE] req.userId yoxdur')
        return res.status(401).json({ message: 'İstifadəçi autentifikasiya olunmayıb' })
      }

      const userId = typeof req.userId === 'string' ? parseInt(req.userId) : req.userId
      
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { role: true },
      })

      if (!user) {
        console.error(`❌ [ROLE] İstifadəçi tapılmadı: userId=${userId}`)
        return res.status(401).json({ message: 'İstifadəçi tapılmadı' })
      }

      const userRole = user.role || 'user'
      console.log(`🔍 [ROLE] İstifadəçi role: ${userRole}, tələb olunan: ${allowedRoles.join(', ')}`)

      if (!allowedRoles.includes(userRole)) {
        console.error(`❌ [ROLE] Yetki yoxdur: userRole=${userRole}, allowedRoles=${allowedRoles.join(', ')}`)
        return res.status(403).json({ message: 'Bu əməliyyat üçün yetkiniz yoxdur (Admin tələb olunur)' })
      }

      // Role-u request-ə əlavə et
      req.userRole = userRole
      next()
    } catch (error: any) {
      console.error('❌ [ROLE] Role middleware error:', error)
      console.error('Error stack:', error.stack)
      res.status(500).json({ message: 'Xəta baş verdi' })
    }
  }
}

// Admin-only middleware
export const requireAdmin = requireRole(['admin'])

