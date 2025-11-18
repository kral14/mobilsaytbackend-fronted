import { Request, Response } from 'express'
import prisma from '../config/database'
import { hashPassword, comparePassword } from '../utils/hashPassword'
import { generateToken } from '../utils/generateToken'

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone } = req.body

    // Email yoxla
    const existingUser = await prisma.users.findUnique({
      where: { email },
    })

    if (existingUser) {
      return res.status(400).json({ message: 'Bu email artıq istifadə olunur' })
    }

    // Şifrəni hash et
    const hashedPassword = await hashPassword(password)

    // İstifadəçi yarat
    const user = await prisma.users.create({
      data: {
        email,
        password: hashedPassword,
      },
    })

    // Müştəri yarat (əgər name və ya phone varsa)
    let customer = null
    if (name || phone) {
      customer = await prisma.customers.create({
        data: {
          name: name || '',
          phone: phone || null,
          email: email,
        },
      })
    }

    // Token yarat
    const token = generateToken(user.id.toString())

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
      },
      customer: customer ? {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
      } : null,
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Qeydiyyat zamanı xəta baş verdi' })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    // İstifadəçini tap
    const user = await prisma.users.findUnique({
      where: { email },
    })

    if (!user) {
      return res.status(401).json({ message: 'Email və ya şifrə yanlışdır' })
    }

    // Şifrəni yoxla
    const isPasswordValid = await comparePassword(password, user.password)

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email və ya şifrə yanlışdır' })
    }

    // Müştəri məlumatlarını tap
    const customer = await prisma.customers.findFirst({
      where: { email },
    })

    // Token yarat
    const token = generateToken(user.id.toString())

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
      },
      customer: customer ? {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        balance: customer.balance,
      } : null,
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Giriş zamanı xəta baş verdi' })
  }
}
