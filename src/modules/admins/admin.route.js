import { Router } from 'express'
import { registerAdmin, loginAdmin, listOrdersForAdmin, verifyOrderStatus, rejectOrderStatus } from './admin.controller.js'
import { verifyToken } from '../../middleware/auth.middleware.js'

const router = Router()

// Public routes
router.post('/register', registerAdmin)
router.post('/login', loginAdmin)

// Admin orders
router.get('/orders', verifyToken, listOrdersForAdmin)
router.patch('/orders/:id/verify', verifyToken, verifyOrderStatus)
router.patch('/orders/:id/reject', verifyToken, rejectOrderStatus)

export default router