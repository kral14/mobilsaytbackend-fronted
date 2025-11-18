import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../middleware/auth'

export const getAllSuppliers = async (req: AuthRequest, res: Response) => {
  try {
    const suppliers = await prisma.suppliers.findMany({
      orderBy: {
        name: 'asc',
      },
    })

    res.json(suppliers)
  } catch (error) {
    console.error('Get suppliers error:', error)
    res.status(500).json({ message: 'Təchizatçılar yüklənərkən xəta baş verdi' })
  }
}

