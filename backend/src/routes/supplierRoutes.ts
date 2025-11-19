import { Router } from 'express'
import {
  getAllSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  moveSuppliersToFolder,
} from '../controllers/supplierController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Satıcıları görüntüləmək üçün auth lazımdır
router.get('/', authMiddleware, getAllSuppliers)

// Yeni satıcı yarat
router.post('/', authMiddleware, createSupplier)

// Satıcı yenilə
router.put('/:id', authMiddleware, updateSupplier)

// Satıcı sil
router.delete('/:id', authMiddleware, deleteSupplier)

// Satıcıları papkaya köçür
router.post('/move-to-folder', authMiddleware, moveSuppliersToFolder)

export default router

