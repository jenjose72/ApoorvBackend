import { productService } from './product.service.js';

export const productController = {
    async getAllProducts(req, res, next) {
        try {
            const products = await productService.getAllProducts();
            res.json(products);
        } catch (error) {
            next(error);
        }
    },

    async getProductById(req, res, next) {
        try {
            const { id } = req.params;
            if (isNaN(id)) {
                const error = new Error('Invalid product ID');
                error.statusCode = 400;
                throw error;
            }

            const product = await productService.getProductById(id);
            if (!product) {
                const error = new Error('Product not found');
                error.statusCode = 404;
                throw error;
            }

            res.json(product);
        } catch (error) {
            next(error);
        }
    }
};
