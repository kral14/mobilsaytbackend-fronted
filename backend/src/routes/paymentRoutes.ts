import { Router } from 'express'
import {
  getAllPayments,
  createSupplierPayment,
  createCustomerPayment,
  deletePayment,
  getCashBalance,
} from '../controllers/paymentController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Bütün route-lar üçün auth lazımdır
router.use(authMiddleware)

router.get('/', getAllPayments)
router.get('/balance', getCashBalance)
router.post('/supplier', createSupplierPayment)
router.post('/customer', createCustomerPayment)
router.delete('/:id', deletePayment)

export default router

