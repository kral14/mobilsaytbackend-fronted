import { Response } from 'express'
import prisma from '../config/database'
import { AuthRequest } from '../middleware/auth'

// Bütün kateqoriyaları ağac strukturu ilə gətir
export const getAllCategories = async (req: AuthRequest, res: Response) => {
  try {
    console.log('🔍 [DEBUG] getAllCategories çağırıldı')
    
    const categories = await prisma.categories.findMany({
      include: {
        children: true,
        _count: {
          select: { products: true }
        }
      },
      orderBy: {
        name: 'asc',
      },
    })

    console.log('✅ [DEBUG] Categories yükləndi:', categories.length)
    res.json(categories)
  } catch (error: any) {
    console.error('❌ [ERROR] Get categories error:')
    console.error('❌ [ERROR] Error message:', error.message)
    console.error('❌ [ERROR] Error code:', error.code)
    console.error('❌ [ERROR] Error stack:', error.stack)
    
    // Əgər cədvəl yoxdursa və ya Prisma Client-də model yoxdursa, boş array qaytar
    if (error.code === 'P2021' || 
        error.message?.includes('does not exist') || 
        error.message?.includes('Unknown model') ||
        error.message?.includes('Cannot read properties of undefined') ||
        error.message?.includes('prisma.categories is undefined')) {
      console.log('⚠️ [WARN] Categories cədvəli yoxdur və ya Prisma Client yenidən generate olunmayıb')
      console.log('⚠️ [WARN] Migration və Prisma generate tətbiq edin')
      res.json([])
      return
    }
    
    res.status(500).json({ message: 'Kateqoriyalar yüklənərkən xəta baş verdi', error: error.message })
  }
}

// Yeni kateqoriya yarat
export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    console.log('🔍 [DEBUG] createCategory çağırıldı')
    console.log('🔍 [DEBUG] Request body:', req.body)
    
    const { name, parent_id } = req.body
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Kateqoriya adı məcburidir' })
    }
    
    const category = await prisma.categories.create({
      data: {
        name: name.trim(),
        parent_id: parent_id ? parseInt(parent_id) : null,
      },
      include: {
        _count: {
          select: { products: true }
        }
      }
    })
    
    console.log('✅ [DEBUG] Category yaradıldı:', category.id, category.name)
    res.status(201).json(category)
  } catch (error: any) {
    console.error('❌ [ERROR] Create category error:')
    console.error('❌ [ERROR] Error message:', error.message)
    console.error('❌ [ERROR] Error code:', error.code)
    console.error('❌ [ERROR] Error stack:', error.stack)
    
    // Əgər cədvəl yoxdursa və ya Prisma Client-də model yoxdursa
    if (error.code === 'P2021' || 
        error.message?.includes('does not exist') ||
        error.message?.includes('Unknown model') ||
        error.message?.includes('Cannot read properties of undefined') ||
        error.message?.includes('prisma.categories is undefined')) {
      return res.status(500).json({ 
        message: 'Categories cədvəli yoxdur və ya Prisma Client yenidən generate olunmayıb. Migration və Prisma generate tətbiq edin.',
        error: error.message 
      })
    }
    
    res.status(500).json({ message: 'Kateqoriya yaradılarkən xəta baş verdi', error: error.message })
  }
}

// Kateqoriya yenilə
export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    console.log('🔍 [DEBUG] updateCategory çağırıldı')
    const { id } = req.params
    const { name, parent_id } = req.body
    
    const updatedCategory = await prisma.categories.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name: name.trim() }),
        ...(parent_id !== undefined && { parent_id: parent_id ? parseInt(parent_id) : null }),
      },
      include: {
        _count: {
          select: { products: true }
        }
      }
    })
    
    console.log('✅ [DEBUG] Category yeniləndi:', updatedCategory.id)
    res.json(updatedCategory)
  } catch (error: any) {
    console.error('❌ [ERROR] Update category error:', error)
    res.status(500).json({ message: 'Kateqoriya yenilənərkən xəta baş verdi', error: error.message })
  }
}

// Kateqoriya sil
export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    console.log('🔍 [DEBUG] deleteCategory çağırıldı')
    const { id } = req.params
    
    // Məhsulları bu kateqoriyadan çıxar (əgər category_id sütunu varsa)
    try {
      const columnCheck: any = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name = 'category_id'
        LIMIT 1
      `
      if (columnCheck && Array.isArray(columnCheck) && columnCheck.length > 0) {
        await prisma.products.updateMany({
          where: { category_id: parseInt(id) },
          data: { category_id: null },
        })
      }
    } catch (e) {
      // category_id sütunu yoxdur, keç
      console.log('⚠️ [WARN] category_id sütunu yoxdur, məhsullar köçürülmədi')
    }
    
    // Alt kateqoriyaların parent_id-sini null et
    await prisma.categories.updateMany({
      where: { parent_id: parseInt(id) },
      data: { parent_id: null },
    })
    
    await prisma.categories.delete({
      where: { id: parseInt(id) },
    })
    
    console.log('✅ [DEBUG] Category silindi:', id)
    res.status(204).send()
  } catch (error: any) {
    console.error('❌ [ERROR] Delete category error:', error)
    res.status(500).json({ message: 'Kateqoriya silinərkən xəta baş verdi', error: error.message })
  }
}

// Məhsulları kateqoriyaya köçür
export const moveProductsToCategory = async (req: AuthRequest, res: Response) => {
  try {
    console.log('🔍 [DEBUG] moveProductsToCategory çağırıldı')
    console.log('🔍 [DEBUG] Request body:', req.body)
    
    const { product_ids, category_id } = req.body
    
    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ message: 'Məhsul ID-ləri məcburidir' })
    }

    await prisma.products.updateMany({
      where: {
        id: {
          in: product_ids.map((id: number) => parseInt(id.toString())),
        },
      },
      data: {
        category_id: category_id ? parseInt(category_id.toString()) : null,
      },
    })
    
    console.log('✅ [DEBUG] Məhsullar köçürüldü:', product_ids.length)
    res.status(200).json({ message: 'Məhsullar uğurla köçürüldü' })
  } catch (error: any) {
    console.error('❌ [ERROR] Move products to category error:', error)
    res.status(500).json({ message: 'Məhsullar köçürülərkən xəta baş verdi', error: error.message })
  }
}
