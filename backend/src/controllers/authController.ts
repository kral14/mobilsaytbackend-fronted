import { Request, Response } from 'express'
import prisma from '../config/database'
import { hashPassword, comparePassword } from '../utils/hashPassword'
import { generateToken } from '../utils/generateToken'

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone } = req.body

    console.log('👤 [AUTH] Register cəhdi:', {
      email,
      hasPassword: !!password,
      name,
      phone,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      referer: req.headers.referer || req.headers.referrer,
    })

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

    console.log('✅ [AUTH] Register uğurlu:', {
      userId: user.id,
      email: user.email,
      customerId: customer?.id,
    })

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
    console.error('❌ [AUTH] Register error:', error)
    res.status(500).json({ message: 'Qeydiyyat zamanı xəta baş verdi' })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    console.log('👤 [AUTH] Login cəhdi:', {
      email,
      hasPassword: !!password,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      origin: req.headers.origin,
      referer: req.headers.referer || req.headers.referrer,
    })

    // İstifadəçini tap
    const user = await prisma.users.findUnique({
      where: { email },
    })

    if (!user) {
      console.warn('⚠️ [AUTH] Login uğursuz - istifadəçi tapılmadı:', { email })
      return res.status(401).json({ message: 'Email və ya şifrə yanlışdır' })
    }

    // Şifrəni yoxla
    const isPasswordValid = await comparePassword(password, user.password)

    if (!isPasswordValid) {
      console.warn('⚠️ [AUTH] Login uğursuz - şifrə yanlışdır:', { email, userId: user.id })
      return res.status(401).json({ message: 'Email və ya şifrə yanlışdır' })
    }

    // Müştəri məlumatlarını tap
    const customer = await prisma.customers.findFirst({
      where: { email },
    })

    // Token yarat
    const token = generateToken(user.id.toString())

    console.log('✅ [AUTH] Login uğurlu:', {
      userId: user.id,
      email: user.email,
      customerId: customer?.id,
    })

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
    console.error('❌ [AUTH] Login error:', error)
    res.status(500).json({ message: 'Giriş zamanı xəta baş verdi' })
  }
}
