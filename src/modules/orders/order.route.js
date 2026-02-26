import { Router } from "express"
import { orderController } from './orders.controller.js'
const router = Router()

router.post('/', orderController.createOrder)
router.get('/:id', orderController.getOrderById)

export default router