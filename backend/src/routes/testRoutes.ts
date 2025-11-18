import { Router } from 'express'
import prisma from '../config/database'

const router = Router()

// Migration status yoxlamaq üçün test endpoint
router.get('/migration-status', async (req, res) => {
  try {
    const status: any = {
      categories_table: false,
      products_columns: [] as string[],
      foreign_key: false,
      prisma_client: false,
    }

    // Categories cədvəlinin olub-olmadığını yoxla
    try {
      const tableCheck: any = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'categories'
        ) as exists;
      `
      status.categories_table = tableCheck[0]?.exists || false
    } catch (e) {
      status.categories_table = false
    }

    // Products cədvəlində yeni sütunların olub-olmadığını yoxla
    try {
      const columnCheck: any = await prisma.$queryRaw`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'products' 
        AND column_name IN ('article', 'category_id', 'type', 'brand', 'model', 'color', 'size', 'weight', 'country', 'manufacturer', 'warranty_period', 'min_stock', 'max_stock', 'tax_rate', 'is_active');
      `
      status.products_columns = columnCheck.map((c: any) => c.column_name)
    } catch (e) {
      status.products_columns = []
    }

    // Foreign key constraint yoxla
    try {
      const fkCheck: any = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'products_category_id_fkey'
        ) as exists;
      `
      status.foreign_key = fkCheck[0]?.exists || false
    } catch (e) {
      status.foreign_key = false
    }

    // Prisma Client-də categories model-inin olub-olmadığını yoxla
    try {
      // Try to access prisma.categories
      // Check if categories property exists and is not undefined
      const hasCategories = 'categories' in prisma
      let categoriesType: string = 'undefined'
      try {
        categoriesType = typeof (prisma as any).categories
      } catch (e) {
        categoriesType = 'error'
      }
      
      status.prisma_client = hasCategories && categoriesType !== 'undefined' && categoriesType !== 'error'
      
      // Debug info
      status.prisma_client_debug = {
        hasCategories,
        categoriesType,
        prismaKeys: Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'))
      }
    } catch (e: any) {
      status.prisma_client = false
      status.prisma_client_error = e.message
    }

    // Nəticə
    const allGood = 
      status.categories_table && 
      status.products_columns.length === 15 && 
      status.foreign_key && 
      status.prisma_client

    res.json({
      success: allGood,
      message: allGood 
        ? '✅ Migration uğurla tətbiq olunub!' 
        : '❌ Migration tam tətbiq olunmayıb',
      status,
      required_columns: [
        'article', 'category_id', 'type', 'brand', 'model', 
        'color', 'size', 'weight', 'country', 'manufacturer',
        'warranty_period', 'min_stock', 'max_stock', 'tax_rate', 'is_active'
      ],
      missing_columns: [
        'article', 'category_id', 'type', 'brand', 'model', 
        'color', 'size', 'weight', 'country', 'manufacturer',
        'warranty_period', 'min_stock', 'max_stock', 'tax_rate', 'is_active'
      ].filter(col => !status.products_columns.includes(col))
    })
  } catch (error: any) {
    res.status(500).json({ 
      success: false,
      message: 'Migration status yoxlanıla bilmədi', 
      error: error.message 
    })
  }
})

export default router

