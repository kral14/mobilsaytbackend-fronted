import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../middleware/auth'

// Bütün satıcı papkalarını al
export const getAllSupplierFolders = async (req: AuthRequest, res: Response) => {
  try {
    const folders = await prisma.supplier_folders.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        _count: {
          select: {
            suppliers: true,
          },
        },
      },
    })

    const foldersWithCount = folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      parent_id: folder.parent_id,
      created_at: folder.created_at,
      updated_at: folder.updated_at,
      supplier_count: folder._count.suppliers,
    }))

    res.json(foldersWithCount)
  } catch (error: any) {
    console.error('Get supplier folders error:', error)
    console.error('Error details:', error.message, error.code)
    console.error('Error stack:', error.stack)

    let hint = undefined
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      hint = 'Database schema yenilənməyib. Prisma migration tətbiq edin: npx prisma db push'
    } else if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      hint = 'Supplier_folders cədvəli mövcud deyil. prisma db push və ya SQL skriptini çalışdırın.'
    }

    res.status(500).json({
      message: 'Satıcı papkaları yüklənərkən xəta baş verdi',
      error: error.message,
      code: error.code,
      hint,
    })
  }
}

// Yeni satıcı papkası yarat
export const createSupplierFolder = async (req: AuthRequest, res: Response) => {
  try {
    const { name, parent_id } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Papka adı məcburidir' })
    }

    if (parent_id) {
      const parentFolder = await prisma.supplier_folders.findUnique({
        where: { id: parseInt(parent_id) },
      })

      if (!parentFolder) {
        return res.status(404).json({ message: 'Ana papka tapılmadı' })
      }
    }

    const folder = await prisma.supplier_folders.create({
      data: {
        name: name.trim(),
        parent_id: parent_id ? parseInt(parent_id) : null,
      },
      include: {
        _count: {
          select: {
            suppliers: true,
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
      supplier_count: folder._count.suppliers,
    })
  } catch (error: any) {
    console.error('Create supplier folder error:', error)
    res.status(500).json({ message: 'Papka yaradılarkən xəta baş verdi', error: error.message })
  }
}

// Satıcı papkasını yenilə
export const updateSupplierFolder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, parent_id } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Papka adı məcburidir' })
    }

    const existingFolder = await prisma.supplier_folders.findUnique({
      where: { id: parseInt(id) },
    })

    if (!existingFolder) {
      return res.status(404).json({ message: 'Papka tapılmadı' })
    }

    if (parent_id) {
      const parentFolder = await prisma.supplier_folders.findUnique({
        where: { id: parseInt(parent_id) },
      })

      if (!parentFolder) {
        return res.status(404).json({ message: 'Ana papka tapılmadı' })
      }

      if (parseInt(parent_id) === parseInt(id)) {
        return res.status(400).json({ message: 'Papka özünün alt papkası ola bilməz' })
      }

      const checkCircular = async (folderId: number, targetParentId: number): Promise<boolean> => {
        let currentId = targetParentId
        while (currentId) {
          if (currentId === folderId) return true
          const parent = await prisma.supplier_folders.findUnique({
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

    const folder = await prisma.supplier_folders.update({
      where: { id: parseInt(id) },
      data: {
        name: name.trim(),
        parent_id: parent_id ? parseInt(parent_id) : null,
        updated_at: new Date(),
      },
      include: {
        _count: {
          select: {
            suppliers: true,
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
      supplier_count: folder._count.suppliers,
    })
  } catch (error: any) {
    console.error('Update supplier folder error:', error)
    res.status(500).json({ message: 'Papka yenilənərkən xəta baş verdi', error: error.message })
  }
}

// Satıcı papkasını sil
export const deleteSupplierFolder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const folder = await prisma.supplier_folders.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            suppliers: true,
            children: true,
          },
        },
      },
    })

    if (!folder) {
      return res.status(404).json({ message: 'Papka tapılmadı' })
    }

    if (folder._count.suppliers > 0) {
      await prisma.suppliers.updateMany({
        where: { folder_id: parseInt(id) },
        data: { folder_id: null },
      })
    }

    if (folder._count.children > 0) {
      await prisma.supplier_folders.updateMany({
        where: { parent_id: parseInt(id) },
        data: { parent_id: null },
      })
    }

    await prisma.supplier_folders.delete({
      where: { id: parseInt(id) },
    })

    res.json({ message: 'Papka silindi' })
  } catch (error: any) {
    console.error('Delete supplier folder error:', error)
    res.status(500).json({ message: 'Papka silinərkən xəta baş verdi', error: error.message })
  }
}


