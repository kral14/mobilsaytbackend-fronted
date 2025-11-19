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
  } catch (error: any) {
    console.error('Get suppliers error:', error)
    console.error('Error details:', error.message, error.code)
    console.error('Error stack:', error.stack)

    let hint = undefined
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      hint = 'Database schema yenilənməyib. Prisma migration tətbiq edin: npx prisma db push'
    } else if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      hint = 'Suppliers və ya supplier_folders cədvəli mövcud deyil. Prisma migration və ya SQL skriptini çalışdırın.'
    }

    res.status(500).json({
      message: 'Satıcılar yüklənərkən xəta baş verdi',
      error: error.message,
      code: error.code,
      hint,
    })
  }
}

// Yeni satıcı yarat
export const createSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, email, address, balance, folder_id, code } = req.body

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Satıcı adı məcburidir' })
    }

    // Əgər folder_id varsa, onun mövcud olduğunu yoxla
    if (folder_id !== undefined && folder_id !== null) {
      const folder = await prisma.supplier_folders.findUnique({
        where: { id: parseInt(folder_id) },
      })

      if (!folder) {
        return res.status(404).json({ message: 'Papka tapılmadı' })
      }
    }

    // Kod generasiyası - əgər kod verilməyibsə
    let supplierCode = code as string | undefined
    if (!supplierCode || supplierCode.trim() === '') {
      // Son satıcının kodunu tap (SA ilə başlayan)
      const lastSupplier = await prisma.suppliers.findFirst({
        where: {
          code: {
            startsWith: 'SA',
          },
        },
        orderBy: {
          code: 'desc',
        },
      })

      if (lastSupplier && lastSupplier.code) {
        const lastNumber = parseInt(lastSupplier.code.replace('SA', '')) || 0
        const newNumber = lastNumber + 1
        supplierCode = `SA${String(newNumber).padStart(8, '0')}`
      } else {
        // İlk satıcı
        supplierCode = 'SA00000001'
      }
    } else {
      supplierCode = supplierCode.trim()
    }

    const supplier = await prisma.suppliers.create({
      data: {
        code: supplierCode,
        name: name.trim(),
        phone: phone && String(phone).trim() !== '' ? String(phone).trim() : null,
        email: email && String(email).trim() !== '' ? String(email).trim() : null,
        address: address && String(address).trim() !== '' ? String(address).trim() : null,
        balance: balance !== undefined && balance !== null ? parseFloat(balance) : 0,
        folder_id: folder_id !== undefined && folder_id !== null ? parseInt(folder_id) : null,
      },
    })

    res.status(201).json(supplier)
  } catch (error: any) {
    console.error('Create supplier error:', error)
    res.status(500).json({
      message: 'Satıcı yaradılarkən xəta baş verdi',
      error: error.message,
    })
  }
}

// Satıcı yenilə
export const updateSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, phone, email, address, balance, folder_id, code } = req.body

    const existingSupplier = await prisma.suppliers.findUnique({
      where: { id: parseInt(id) },
    })

    if (!existingSupplier) {
      return res.status(404).json({ message: 'Satıcı tapılmadı' })
    }

    if (folder_id !== undefined && folder_id !== null) {
      const folder = await prisma.supplier_folders.findUnique({
        where: { id: parseInt(folder_id) },
      })

      if (!folder) {
        return res.status(404).json({ message: 'Papka tapılmadı' })
      }
    }

    // Kod generasiyası - əgər həm mövcud kod, həm də gələn kod boşdursa
    let supplierCode = code as string | undefined
    if ((!supplierCode || supplierCode.trim() === '') && (!existingSupplier.code || existingSupplier.code.trim() === '')) {
      const lastSupplier = await prisma.suppliers.findFirst({
        where: {
          code: {
            startsWith: 'SA',
          },
        },
        orderBy: {
          code: 'desc',
        },
      })

      if (lastSupplier && lastSupplier.code) {
        const lastNumber = parseInt(lastSupplier.code.replace('SA', '')) || 0
        const newNumber = lastNumber + 1
        supplierCode = `SA${String(newNumber).padStart(8, '0')}`
      } else {
        supplierCode = 'SA00000001'
      }
    } else if (supplierCode && supplierCode.trim() !== '') {
      supplierCode = supplierCode.trim()
    } else {
      supplierCode = existingSupplier.code ?? undefined
    }

    const updatedSupplier = await prisma.suppliers.update({
      where: { id: parseInt(id) },
      data: {
        ...(supplierCode !== undefined && { code: supplierCode }),
        ...(name !== undefined && { name: name.trim() }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(balance !== undefined && { balance }),
        ...(folder_id !== undefined && { folder_id: folder_id ? parseInt(folder_id) : null }),
        updated_at: new Date(),
      },
    })

    res.json(updatedSupplier)
  } catch (error: any) {
    console.error('Update supplier error:', error)
    res.status(500).json({
      message: 'Satıcı yenilənərkən xəta baş verdi',
      error: error.message,
    })
  }
}

// Satıcı sil
export const deleteSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const existingSupplier = await prisma.suppliers.findUnique({
      where: { id: parseInt(id) },
    })

    if (!existingSupplier) {
      return res.status(404).json({ message: 'Satıcı tapılmadı' })
    }

    await prisma.suppliers.delete({
      where: { id: parseInt(id) },
    })

    res.json({ message: 'Satıcı uğurla silindi' })
  } catch (error: any) {
    console.error('Delete supplier error:', error)
    res.status(500).json({
      message: 'Satıcı silinərkən xəta baş verdi',
      error: error.message,
    })
  }
}

// Satıcıları papkaya köçür
export const moveSuppliersToFolder = async (req: AuthRequest, res: Response) => {
  try {
    const { supplier_ids, folder_id } = req.body

    if (!supplier_ids || !Array.isArray(supplier_ids) || supplier_ids.length === 0) {
      return res.status(400).json({ message: 'Satıcı ID-ləri məcburidir' })
    }

    if (folder_id !== null && folder_id !== undefined) {
      const folder = await prisma.supplier_folders.findUnique({
        where: { id: parseInt(folder_id) },
      })

      if (!folder) {
        return res.status(404).json({ message: 'Papka tapılmadı' })
      }
    }

    const updatedSuppliers = await prisma.suppliers.updateMany({
      where: {
        id: {
          in: supplier_ids.map((id: number) => parseInt(String(id))),
        },
      },
      data: {
        folder_id: folder_id ? parseInt(folder_id) : null,
        updated_at: new Date(),
      },
    })

    res.json({
      message: `${updatedSuppliers.count} satıcı papkaya köçürüldü`,
      count: updatedSuppliers.count,
    })
  } catch (error: any) {
    console.error('Move suppliers to folder error:', error)
    res.status(500).json({
      message: 'Satıcılar köçürülərkən xəta baş verdi',
      error: error.message,
    })
  }
}


