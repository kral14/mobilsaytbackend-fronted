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

router.use(authMiddleware)

router.get('/', getAllCategories)
router.post('/', createCategory)
router.put('/:id', updateCategory)
router.delete('/:id', deleteCategory)
router.post('/move-products', moveProductsToCategory)

export default router

