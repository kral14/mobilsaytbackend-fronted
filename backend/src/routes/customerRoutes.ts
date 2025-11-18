import { Router } from 'express'
import { getAllCustomers, createCustomer, updateCustomer, deleteCustomer, moveCustomersToFolder } from '../controllers/customerController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Müştəriləri görüntüləmək üçün auth lazımdır
router.get('/', authMiddleware, getAllCustomers)

// Yeni müştəri yarat
router.post('/', authMiddleware, createCustomer)

// Müştərini yenilə
router.put('/:id', authMiddleware, updateCustomer)

// Müştərini sil
router.delete('/:id', authMiddleware, deleteCustomer)

// Müştəriləri papkaya köçür
router.post('/move-to-folder', authMiddleware, moveCustomersToFolder)

export default router

