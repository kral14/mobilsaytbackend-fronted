import { Router } from 'express'
import {
  getAllPurchaseInvoices,
  getPurchaseInvoiceById,
  createPurchaseInvoice,
  updatePurchaseInvoice,
  updatePurchaseInvoiceStatus,
  deletePurchaseInvoice,
} from '../controllers/purchaseInvoiceController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Bütün purchase invoice route-ları üçün auth lazımdır
router.use(authMiddleware)

router.get('/', getAllPurchaseInvoices)
router.get('/:id', getPurchaseInvoiceById)
router.post('/', createPurchaseInvoice)
router.patch('/:id', updatePurchaseInvoice)
router.patch('/:id/status', updatePurchaseInvoiceStatus)
router.delete('/:id', deletePurchaseInvoice)

export default router

