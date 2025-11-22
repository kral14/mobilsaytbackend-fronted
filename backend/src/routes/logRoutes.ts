import { Router } from 'express'
import { getAllLogs, deleteLogs, getInvoiceNumbers } from '../controllers/logController'
import { getAllLogFiles, downloadLogFile, deleteLogFile, syncLogFile } from '../controllers/userLogController'
import { authMiddleware } from '../middleware/auth'
import { requireAdmin } from '../middleware/role'

const router = Router()

// Bütün log route-ları üçün auth və admin lazımdır
router.use(authMiddleware)
router.use(requireAdmin)

// Verilənlər bazasındakı loglar
router.get('/', getAllLogs)
router.get('/invoice-numbers', getInvoiceNumbers)
router.delete('/', deleteLogs)

// İstifadəçi log faylları
router.get('/files', getAllLogFiles)
router.get('/files/:userId/download', downloadLogFile)
router.delete('/files/:userId', deleteLogFile)
router.post('/files/:userId/sync', syncLogFile)

export default router

