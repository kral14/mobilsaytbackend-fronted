import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../middleware/auth'

// Bütün papkaları al
export const getAllCustomerFolders = async (req: AuthRequest, res: Response) => {
  try {
    const folders = await prisma.customer_folders.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            customers: true,
          },
        },
      },
    })

    // Customer count-u əlavə et
    const foldersWithCount = folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      parent_id: folder.parent_id,
      created_at: folder.created_at,
      updated_at: folder.updated_at,
      customer_count: folder._count.customers,
    }))

    res.json(foldersWithCount)
  } catch (error: any) {
    console.error('Get customer folders error:', error)
    console.error('Error details:', error.message, error.code)
    console.error('Error stack:', error.stack)
    
    let hint = undefined
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      hint = 'Database schema yenilənməyib. Prisma migration tətbiq edin: npx prisma db push'
    } else if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      hint = 'Customer_folders cədvəli mövcud deyil. backend/create_all_tables.sql skriptini çalışdırın.'
    }
    
    res.status(500).json({ 
      message: 'Papkalar yüklənərkən xəta baş verdi',
      error: error.message,
      code: error.code,
      hint: hint
    })
  }
}

// Yeni papka yarat
export const createCustomerFolder = async (req: AuthRequest, res: Response) => {
  try {
    const { name, parent_id } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Papka adı məcburidir' })
    }

    // Əgər parent_id varsa, onun mövcud olduğunu yoxla
    if (parent_id) {
      const parentFolder = await prisma.customer_folders.findUnique({
        where: { id: parseInt(parent_id) },
      })

      if (!parentFolder) {
        return res.status(404).json({ message: 'Ana papka tapılmadı' })
      }
    }

    const folder = await prisma.customer_folders.create({
      data: {
        name: name.trim(),
        parent_id: parent_id ? parseInt(parent_id) : null,
      },
      include: {
        _count: {
          select: {
            customers: true,
          },
        },
      },
    })

    res.status(201).json({
      id: folder.id,
      name: folder.name,
      parent_id: folder.parent_id,
      created_at: folder.created_at,
      updated_at: folder.updated_at,
      customer_count: folder._count.customers,
    })
  } catch (error: any) {
    console.error('Create customer folder error:', error)
    res.status(500).json({ message: 'Papka yaradılarkən xəta baş verdi', error: error.message })
  }
}

// Papka yenilə
export const updateCustomerFolder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, parent_id } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Papka adı məcburidir' })
    }

    // Papkanın mövcud olduğunu yoxla
    const existingFolder = await prisma.customer_folders.findUnique({
      where: { id: parseInt(id) },
    })

    if (!existingFolder) {
      return res.status(404).json({ message: 'Papka tapılmadı' })
    }

    // Əgər parent_id varsa, onun mövcud olduğunu və döngü yaratmadığını yoxla
    if (parent_id) {
      const parentFolder = await prisma.customer_folders.findUnique({
        where: { id: parseInt(parent_id) },
      })

      if (!parentFolder) {
        return res.status(404).json({ message: 'Ana papka tapılmadı' })
      }

      // Döngü yoxlaması: özünü özünün alt papkası etməyə çalışırsa
      if (parseInt(parent_id) === parseInt(id)) {
        return res.status(400).json({ message: 'Papka özünün alt papkası ola bilməz' })
      }

      // Əgər parent_id dəyişirsə, döngü yoxlaması
      const checkCircular = async (folderId: number, targetParentId: number): Promise<boolean> => {
        let currentId = targetParentId
        while (currentId) {
          if (currentId === folderId) return true
          const parent = await prisma.customer_folders.findUnique({
            where: { id: currentId },
            select: { parent_id: true },
          })
          if (!parent || !parent.parent_id) break
          currentId = parent.parent_id
        }
        return false
      }

      if (await checkCircular(parseInt(id), parseInt(parent_id))) {
        return res.status(400).json({ message: 'Döngü yaradıla bilməz' })
      }
    }

    const folder = await prisma.customer_folders.update({
      where: { id: parseInt(id) },
      data: {
        name: name.trim(),
        parent_id: parent_id ? parseInt(parent_id) : null,
        updated_at: new Date(),
      },
      include: {
        _count: {
          select: {
            customers: true,
          },
        },
      },
    })

    res.json({
      id: folder.id,
      name: folder.name,
      parent_id: folder.parent_id,
      created_at: folder.created_at,
      updated_at: folder.updated_at,
      customer_count: folder._count.customers,
    })
  } catch (error: any) {
    console.error('Update customer folder error:', error)
    res.status(500).json({ message: 'Papka yenilənərkən xəta baş verdi', error: error.message })
  }
}

// Papka sil
export const deleteCustomerFolder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    // Papkanın mövcud olduğunu yoxla
    const folder = await prisma.customer_folders.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            customers: true,
            children: true,
          },
        },
      },
    })

    if (!folder) {
      return res.status(404).json({ message: 'Papka tapılmadı' })
    }

    // Əgər papkada müştərilər varsa, onları null-a təyin et
    if (folder._count.customers > 0) {
      await prisma.customers.updateMany({
        where: { folder_id: parseInt(id) },
        data: { folder_id: null },
      })
    }

    // Əgər alt papkalar varsa, onların parent_id-ni null-a təyin et
    if (folder._count.children > 0) {
      await prisma.customer_folders.updateMany({
        where: { parent_id: parseInt(id) },
        data: { parent_id: null },
      })
    }

    // Papkanı sil
    await prisma.customer_folders.delete({
      where: { id: parseInt(id) },
    })

    res.json({ message: 'Papka silindi' })
  } catch (error: any) {
    console.error('Delete customer folder error:', error)
    res.status(500).json({ message: 'Papka silinərkən xəta baş verdi', error: error.message })
  }
}

