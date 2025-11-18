import { Router } from 'express'
import { getAllSuppliers } from '../controllers/supplierController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Təchizatçıları görüntüləmək üçün auth lazımdır
router.get('/', authMiddleware, getAllSuppliers)

export default router

