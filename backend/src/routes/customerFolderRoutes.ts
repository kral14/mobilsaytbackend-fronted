import { Router } from 'express'
import {
  getAllCustomerFolders,
  createCustomerFolder,
  updateCustomerFolder,
  deleteCustomerFolder,
} from '../controllers/customerFolderController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Bütün papkaları al
router.get('/', authMiddleware, getAllCustomerFolders)

// Yeni papka yarat
router.post('/', authMiddleware, createCustomerFolder)

// Papka yenilə
router.put('/:id', authMiddleware, updateCustomerFolder)

// Papka sil
router.delete('/:id', authMiddleware, deleteCustomerFolder)

export default router

