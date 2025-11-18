import { Router } from 'express'
import { getProfile, updateProfile } from '../controllers/userController'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// Bütün user route-ları üçün auth lazımdır
router.use(authMiddleware)

router.get('/profile', getProfile)
router.put('/profile', updateProfile)

export default router

