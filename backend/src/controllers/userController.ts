import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../middleware/auth'

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.userId!)

    const user = await prisma.users.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return res.status(404).json({ message: 'İstifadəçi tapılmadı' })
    }

    // Müştəri məlumatlarını tap
    const customer = await prisma.customers.findFirst({
      where: { email: user.email },
    })

    res.json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      customer: customer || null,
    })
  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({ message: 'Profil yüklənərkən xəta baş verdi' })
  }
}

export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.userId!)
    const { name, phone, address } = req.body

    const user = await prisma.users.findUnique({
      where: { id: userId },
    })

    if (!user) {
      return res.status(404).json({ message: 'İstifadəçi tapılmadı' })
    }

    // Müştəri məlumatlarını tap və ya yarat
    let customer = await prisma.customers.findFirst({
      where: { email: user.email },
    })

    if (customer) {
      customer = await prisma.customers.update({
        where: { id: customer.id },
        data: {
          ...(name && { name }),
          ...(phone !== undefined && { phone }),
          ...(address !== undefined && { address }),
        },
      })
    } else {
      customer = await prisma.customers.create({
        data: {
          name: name || '',
          phone: phone || null,
          email: user.email,
          address: address || null,
        },
      })
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      customer,
    })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Profil yenilənərkən xəta baş verdi' })
  }
}
