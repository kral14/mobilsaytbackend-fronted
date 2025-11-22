import { Router } from 'express'
import { getProfile, updateProfile, getAllUsers, createUser, updateUser, deleteUser } from '../controllers/userController'
import { authMiddleware } from '../middleware/auth'
import { requireAdmin } from '../middleware/role'

const router = Router()

// Bütün user route-ları üçün auth lazımdır
router.use(authMiddleware)

// Profile routes (hər kəs öz profilini görə bilər)
router.get('/profile', getProfile)
router.put('/profile', updateProfile)

// Admin routes (yalnız admin)
router.get('/', requireAdmin, getAllUsers)
router.post('/', requireAdmin, createUser)
router.put('/:id', requireAdmin, updateUser)
router.delete('/:id', requireAdmin, deleteUser)

export default router

