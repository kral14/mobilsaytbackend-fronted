import { Router } from 'express'
import {
  getAllSupplierFolders,
  createSupplierFolder,
  updateSupplierFolder,
  deleteSupplierFolder,
} from '../controllers/supplierFolderController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Bütün satıcı papkalarını al
router.get('/', authMiddleware, getAllSupplierFolders)

// Yeni satıcı papkası yarat
router.post('/', authMiddleware, createSupplierFolder)

// Satıcı papkasını yenilə
router.put('/:id', authMiddleware, updateSupplierFolder)

// Satıcı papkasını sil
router.delete('/:id', authMiddleware, deleteSupplierFolder)

export default router


