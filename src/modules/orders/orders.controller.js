import Joi from 'joi';
import { orderService } from './order.service.js';

const unifiedOrderSchema = Joi.object({
    // User Details
    full_name: Joi.string().required(),
    roll_number: Joi.string().required(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).required(),
    email: Joi.string().email().required(),

    // Order Items
    items: Joi.array().items(
        Joi.object({
            product_variant_id: Joi.number().integer().positive().required(),
            quantity: Joi.number().integer().positive().max(5).required()
        })
    ).min(1).required().custom((value, helpers) => {
        // Calculate total quantity across all items
        const totalQuantity = value.reduce((sum, item) => sum + item.quantity, 0);
        if (totalQuantity > 5) {
            return helpers.error('any.custom', {
                message: 'Total quantity across all items cannot exceed 5'
            });
        }
        return value;
    }, 'Total quantity validation'),

    // Payment Details
    upi_account_id: Joi.number().integer().positive().required(),
    upi_transaction_id: Joi.string().trim().min(1).required(),
    amount_paid: Joi.number().precision(2).min(0).required(),

    // CAPTCHA Token
    captchaToken: Joi.string().required()
});

export const orderController = {
    async createOrder(req, res, next) {
        try {
            const { error, value } = unifiedOrderSchema.validate(req.body);
            if (error) {
                const err = new Error(error.details[0].message);
                err.statusCode = 400;
                throw err;
            }

            const result = await orderService.createOrderWithPayment(value);
            res.status(201).json({
                status: 'success',
                message: 'Order and payment submitted successfully',
                data: result
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                error.statusCode = 404;
            } else if (error.message.includes('Insufficient stock') || error.message.includes('match')) {
                error.statusCode = 400;
            } else if (error.message.includes('Duplicate')) {
                error.statusCode = 409;
            }
            next(error);
        }
    },

    async getOrderById(req, res, next) {
        try {
            const { id } = req.params;
            const order = await orderService.getOrderById(id);
            if (!order) {
                const error = new Error('Order not found');
                error.statusCode = 404;
                throw error;
            }

            res.json(order);
        } catch (error) {
            next(error);
        }
    }
};
