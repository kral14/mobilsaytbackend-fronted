import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../middleware/auth'
import { hashPassword } from '../utils/hashPassword'

// İstifadəçi profili götür
export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = parseInt(req.userId!)

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
      },
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
        role: user.role,
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
        role: user.role,
        created_at: user.created_at,
      },
      customer,
    })
  } catch (error) {
    console.error('Update profile error:', error)
    res.status(500).json({ message: 'Profil yenilənərkən xəta baş verdi' })
  }
}

// Bütün istifadəçiləri götür (yalnız admin)
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    })

    res.json(users)
  } catch (error: any) {
    console.error('Get users error:', error)
    res.status(500).json({ message: 'İstifadəçilər yüklənərkən xəta baş verdi' })
  }
}

// İstifadəçi yarat (yalnız admin)
export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, role } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email və şifrə tələb olunur' })
    }

    // Email yoxla
    const existingUser = await prisma.users.findUnique({
      where: { email },
    })

    if (existingUser) {
      return res.status(400).json({ message: 'Bu email artıq istifadə olunur' })
    }

    // Role yoxla
    const validRoles = ['admin', 'user']
    const userRole = role && validRoles.includes(role) ? role : 'user'

    // Şifrəni hash et
    const hashedPassword = await hashPassword(password)

    // İstifadəçi yarat
    const user = await prisma.users.create({
      data: {
        email,
        password: hashedPassword,
        role: userRole,
      },
      select: {
        id: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
      },
    })

    res.status(201).json(user)
  } catch (error: any) {
    console.error('Create user error:', error)
    res.status(500).json({ message: 'İstifadəçi yaradılarkən xəta baş verdi' })
  }
}

// İstifadəçi yenilə (yalnız admin)
export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { email, password, role } = req.body

    const user = await prisma.users.findUnique({
      where: { id: parseInt(id) },
    })

    if (!user) {
      return res.status(404).json({ message: 'İstifadəçi tapılmadı' })
    }

    const updateData: any = {}

    if (email) {
      // Email yoxla
      const existingUser = await prisma.users.findUnique({
        where: { email },
      })

      if (existingUser && existingUser.id !== parseInt(id)) {
        return res.status(400).json({ message: 'Bu email artıq istifadə olunur' })
      }

      updateData.email = email
    }

    if (password) {
      // Şifrəni hash et
      updateData.password = await hashPassword(password)
    }

    if (role) {
      // Role yoxla
      const validRoles = ['admin', 'user']
      if (validRoles.includes(role)) {
        updateData.role = role
      }
    }

    const updatedUser = await prisma.users.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        email: true,
        role: true,
        created_at: true,
        updated_at: true,
      },
    })

    res.json(updatedUser)
  } catch (error: any) {
    console.error('Update user error:', error)
    res.status(500).json({ message: 'İstifadəçi yenilənərkən xəta baş verdi' })
  }
}

// İstifadəçi sil (yalnız admin)
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const user = await prisma.users.findUnique({
      where: { id: parseInt(id) },
    })

    if (!user) {
      return res.status(404).json({ message: 'İstifadəçi tapılmadı' })
    }

    // Özünü silmək olmaz
    if (user.id === req.userId) {
      return res.status(400).json({ message: 'Öz hesabınızı silə bilməzsiniz' })
    }

    await prisma.users.delete({
      where: { id: parseInt(id) },
    })

    res.json({ message: 'İstifadəçi silindi' })
  } catch (error: any) {
    console.error('Delete user error:', error)
    res.status(500).json({ message: 'İstifadəçi silinərkən xəta baş verdi' })
  }
}

