import { Router } from "express"
import { getUpiAccount } from './payment.controller.js'
const router = Router()

router.get('/upi-account', getUpiAccount)

export default router