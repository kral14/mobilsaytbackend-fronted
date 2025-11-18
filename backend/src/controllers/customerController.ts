import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../middleware/auth'

export const getAllCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const customers = await prisma.customers.findMany({
      orderBy: {
        name: 'asc',
      },
    })

    res.json(customers)
  } catch (error: any) {
    console.error('Get customers error:', error)
    console.error('Error details:', error.message, error.code)
    console.error('Error stack:', error.stack)
    
    let hint = undefined
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      hint = 'Database schema yenilənməyib. Prisma migration tətbiq edin: npx prisma db push'
    } else if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      hint = 'Customers cədvəli mövcud deyil. backend/create_all_tables.sql skriptini çalışdırın.'
    }
    
    res.status(500).json({ 
      message: 'Müştərilər yüklənərkən xəta baş verdi',
      error: error.message,
      code: error.code,
      hint: hint
    })
  }
}

// Yeni müştəri yarat
export const createCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, email, address, balance, folder_id, code, is_active } = req.body

    // Ad məcburidir
    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Müştəri adı məcburidir' })
    }

    // Əgər folder_id varsa, onun mövcud olduğunu yoxla
    if (folder_id !== undefined && folder_id !== null) {
      const folder = await prisma.customer_folders.findUnique({
        where: { id: parseInt(folder_id) },
      })

      if (!folder) {
        return res.status(404).json({ message: 'Papka tapılmadı' })
      }
    }

    // Kod generasiyası - əgər kod verilməyibsə
    let customerCode = code
    if (!customerCode || customerCode.trim() === '') {
      // Son müştərinin kodunu tap
      const lastCustomer = await prisma.customers.findFirst({
        where: {
          code: {
            startsWith: 'AL',
          },
        },
        orderBy: {
          code: 'desc',
        },
      })

      if (lastCustomer && lastCustomer.code) {
        // Son koddan nömrəni çıxar və artır
        const lastNumber = parseInt(lastCustomer.code.replace('AL', '')) || 0
        const newNumber = lastNumber + 1
        customerCode = `AL${String(newNumber).padStart(8, '0')}`
      } else {
        // İlk müştəri
        customerCode = 'AL00000001'
      }
    }

    // Yeni müştəri yarat
    const newCustomer = await prisma.customers.create({
      data: {
        code: customerCode,
        name: name.trim(),
        phone: phone && phone.trim() !== '' ? phone.trim() : null,
        email: email && email.trim() !== '' ? email.trim() : null,
        address: address && address.trim() !== '' ? address.trim() : null,
        balance: balance !== undefined && balance !== null ? parseFloat(balance) : 0,
        folder_id: folder_id !== undefined && folder_id !== null ? parseInt(folder_id) : null,
        is_active: is_active !== undefined ? Boolean(is_active) : true,
      },
    })

    res.status(201).json(newCustomer)
  } catch (error: any) {
    console.error('Create customer error:', error)
    res.status(500).json({ 
      message: 'Müştəri yaradılarkən xəta baş verdi',
      error: error.message,
    })
  }
}

// Müştərini yenilə
export const updateCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, phone, email, address, balance, folder_id, code, is_active } = req.body

    // Müştərinin mövcud olduğunu yoxla
    const existingCustomer = await prisma.customers.findUnique({
      where: { id: parseInt(id) },
    })

    if (!existingCustomer) {
      return res.status(404).json({ message: 'Müştəri tapılmadı' })
    }

    // Əgər folder_id varsa, onun mövcud olduğunu yoxla
    if (folder_id !== undefined && folder_id !== null) {
      const folder = await prisma.customer_folders.findUnique({
        where: { id: parseInt(folder_id) },
      })

      if (!folder) {
        return res.status(404).json({ message: 'Papka tapılmadı' })
      }
    }

    // Kod generasiyası - əgər kod yoxdursa və ya boşdursa
    let customerCode = code
    if ((!customerCode || customerCode.trim() === '') && (!existingCustomer.code || existingCustomer.code.trim() === '')) {
      // Son müştərinin kodunu tap
      const lastCustomer = await prisma.customers.findFirst({
        where: {
          code: {
            startsWith: 'AL',
          },
        },
        orderBy: {
          code: 'desc',
        },
      })

      if (lastCustomer && lastCustomer.code) {
        // Son koddan nömrəni çıxar və artır
        const lastNumber = parseInt(lastCustomer.code.replace('AL', '')) || 0
        const newNumber = lastNumber + 1
        customerCode = `AL${String(newNumber).padStart(8, '0')}`
      } else {
        // İlk müştəri
        customerCode = 'AL00000001'
      }
    } else if (customerCode && customerCode.trim() !== '') {
      customerCode = customerCode.trim()
    } else {
      // Mövcud kodu saxla
      customerCode = existingCustomer.code
    }

    // Müştərini yenilə
    const updatedCustomer = await prisma.customers.update({
      where: { id: parseInt(id) },
      data: {
        ...(customerCode !== undefined && { code: customerCode }),
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(balance !== undefined && { balance }),
        ...(folder_id !== undefined && { folder_id: folder_id ? parseInt(folder_id) : null }),
        ...(is_active !== undefined && { is_active: Boolean(is_active) }),
        updated_at: new Date(),
      },
    })

    res.json(updatedCustomer)
  } catch (error: any) {
    console.error('Update customer error:', error)
    res.status(500).json({ 
      message: 'Müştəri yenilənərkən xəta baş verdi',
      error: error.message,
    })
  }
}

// Müştərini sil
export const deleteCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Müştərinin mövcud olduğunu yoxla
    const existingCustomer = await prisma.customers.findUnique({
      where: { id: parseInt(id) },
    })

    if (!existingCustomer) {
      return res.status(404).json({ message: 'Müştəri tapılmadı' })
    }

    // Müştərini sil
    await prisma.customers.delete({
      where: { id: parseInt(id) },
    })

    res.json({ message: 'Müştəri uğurla silindi' })
  } catch (error: any) {
    console.error('Delete customer error:', error)
    res.status(500).json({ 
      message: 'Müştəri silinərkən xəta baş verdi',
      error: error.message,
    })
  }
}

// Müştəriləri papkaya köçür
export const moveCustomersToFolder = async (req: AuthRequest, res: Response) => {
  try {
    const { customer_ids, folder_id } = req.body

    if (!customer_ids || !Array.isArray(customer_ids) || customer_ids.length === 0) {
      return res.status(400).json({ message: 'Müştəri ID-ləri məcburidir' })
    }

    // Əgər folder_id varsa, onun mövcud olduğunu yoxla
    if (folder_id !== null && folder_id !== undefined) {
      const folder = await prisma.customer_folders.findUnique({
        where: { id: parseInt(folder_id) },
      })

      if (!folder) {
        return res.status(404).json({ message: 'Papka tapılmadı' })
      }
    }

    // Müştəriləri yenilə
    const updatedCustomers = await prisma.customers.updateMany({
      where: {
        id: {
          in: customer_ids.map((id: number) => parseInt(String(id))),
        },
      },
      data: {
        folder_id: folder_id ? parseInt(folder_id) : null,
        updated_at: new Date(),
      },
    })

    res.json({ 
      message: `${updatedCustomers.count} müştəri papkaya köçürüldü`,
      count: updatedCustomers.count,
    })
  } catch (error: any) {
    console.error('Move customers to folder error:', error)
    res.status(500).json({ 
      message: 'Müştərilər köçürülərkən xəta baş verdi',
      error: error.message,
    })
  }
}

