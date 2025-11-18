import express from 'express'
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  moveProductsToCategory,
} from '../controllers/categoryController'
import { authMiddleware } from '../middleware/auth'

const router = express.Router()

// Bütün kateqoriyaları gətir (auth lazım deyil - frontend-də istifadə üçün)
router.get('/', (req, res, next) => {
  console.log('🔍 [DEBUG] GET /api/categories route çağırıldı')
  getAllCategories(req as any, res).catch((err) => {
    console.error('❌ [ERROR] Route handler error:', err)
    next(err)
  })
})

// Kateqoriya əməliyyatları üçün auth lazımdır
router.post('/', authMiddleware, createCategory)
router.put('/:id', authMiddleware, updateCategory)
router.delete('/:id', authMiddleware, deleteCategory)
router.post('/move-products', authMiddleware, moveProductsToCategory)

export default router

