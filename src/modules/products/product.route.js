import { Router } from "express"
import { productController } from './product.controller.js'
const router = Router()

router.get('/', productController.getAllProducts)
router.get('/:id', productController.getProductById)

export default router