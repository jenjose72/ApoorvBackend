import { Router } from "express"
import { orderController } from './orders.controller.js'
import { verifyCaptcha } from '../../middleware/captcha.middleware.js'
const router = Router()

router.post('/', verifyCaptcha, orderController.createOrder)
router.get('/:id', orderController.getOrderById)

export default router