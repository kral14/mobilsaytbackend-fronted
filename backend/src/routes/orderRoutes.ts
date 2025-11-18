import { Router } from 'express'
import {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
} from '../controllers/orderController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Bütün order route-ları üçün auth lazımdır
router.use(authMiddleware)

router.get('/', getAllOrders)
router.get('/:id', getOrderById)
router.post('/', createOrder)
router.put('/:id', updateOrder)
router.patch('/:id/status', updateOrderStatus)

export default router

