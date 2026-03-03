import { Router } from 'express'
import { registerAdmin, loginAdmin, listOrdersForAdmin, downloadOrdersCsv, verifyOrderStatus, rejectOrderStatus, changePassword } from './admin.controller.js'
import { verifyToken } from '../../middleware/auth.middleware.js'

const router = Router()

// Public routes
router.post('/register', registerAdmin)
router.post('/login', loginAdmin)

// Protected admin routes
router.put('/change-password', verifyToken, changePassword)

// Admin orders
router.get('/orders', verifyToken, listOrdersForAdmin)
router.get('/orders/csv', verifyToken, downloadOrdersCsv)
router.patch('/orders/:id/verify', verifyToken, verifyOrderStatus)
router.patch('/orders/:id/reject', verifyToken, rejectOrderStatus)

export default router