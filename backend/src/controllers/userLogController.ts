import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { 
  getAllUserLogFiles, 
  readUserLogFile, 
  deleteUserLogFile,
  syncUserLogsToFile 
} from '../utils/userLogFiles'
import prisma from '../config/database'

// Bütün istifadəçi log fayllarının siyahısını götür
export const getAllLogFiles = async (req: AuthRequest, res: Response) => {
  try {
    const logFiles = await getAllUserLogFiles()
    res.json({ logFiles })
  } catch (error: any) {
    console.error('Log faylları siyahısı alına bilmədi:', error)
    res.status(500).json({ message: 'Log faylları siyahısı alına bilmədi' })
  }
}

// İstifadəçinin log faylını yüklə (txt formatında)
export const downloadLogFile = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params
    const userIdNum = parseInt(userId, 10)

    if (isNaN(userIdNum)) {
      return res.status(400).json({ message: 'Yanlış istifadəçi ID' })
    }

    const logContent = await readUserLogFile(userIdNum)

    if (!logContent) {
      return res.status(404).json({ message: 'Log faylı tapılmadı' })
    }

    const user = await prisma.users.findUnique({
      where: { id: userIdNum },
      select: { email: true, full_name: true },
    })

    const fileName = `user_${userIdNum}_${user?.email || 'unknown'}_${new Date().toISOString().split('T')[0]}.txt`

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(logContent)
  } catch (error: any) {
    console.error('Log faylı yüklənə bilmədi:', error)
    res.status(500).json({ message: 'Log faylı yüklənə bilmədi' })
  }
}

// İstifadəçinin log faylını sil
export const deleteLogFile = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params
    const userIdNum = parseInt(userId, 10)

    if (isNaN(userIdNum)) {
      return res.status(400).json({ message: 'Yanlış istifadəçi ID' })
    }

    // Verilənlər bazasından istifadəçinin loglarını sil
    await prisma.activity_logs.deleteMany({
      where: { user_id: userIdNum },
    })

    // Log faylını sil
    await deleteUserLogFile(userIdNum)

    res.json({ message: 'Log faylı və verilənlər bazasındakı loglar silindi' })
  } catch (error: any) {
    console.error('Log faylı silinə bilmədi:', error)
    res.status(500).json({ message: 'Log faylı silinə bilmədi' })
  }
}

// İstifadəçinin loglarını sinxronizasiya et
export const syncLogFile = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params
    const userIdNum = parseInt(userId, 10)

    if (isNaN(userIdNum)) {
      return res.status(400).json({ message: 'Yanlış istifadəçi ID' })
    }

    await syncUserLogsToFile(userIdNum)

    res.json({ message: 'Log faylı sinxronizasiya olundu' })
  } catch (error: any) {
    console.error('Log faylı sinxronizasiya oluna bilmədi:', error)
    res.status(500).json({ message: 'Log faylı sinxronizasiya oluna bilmədi' })
  }
}

