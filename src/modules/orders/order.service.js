import { pool } from '../../config/db.js';

export const orderService = {
    async createOrderWithPayment(data) {
        const {
            full_name, roll_number, phone, email, items,
            upi_account_id, upi_transaction_id, amount_paid
        } = data;

        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Validate maximum purchase limit (5 items total)
            const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
            if (totalQuantity > 5) {
                throw new Error('Maximum purchase limit exceeded. You can only order up to 5 items per order.');
            }

            // 2. Calculate total server-side and check stock
            let totalAmount = 0;
            const orderItems = [];

            for (const item of items) {
                const variantRes = await client.query(
                    `SELECT pv.id, pv.stock_quantity, p.price 
           FROM product_variants pv 
           JOIN products p ON pv.product_id = p.id 
           WHERE pv.id = $1 FOR UPDATE`,
                    [item.product_variant_id]
                );

                if (variantRes.rows.length === 0) {
                    throw new Error(`Product variant ${item.product_variant_id} not found`);
                }

                const variant = variantRes.rows[0];
                if (variant.stock_quantity < item.quantity) {
                    throw new Error(`Insufficient stock for variant ${item.product_variant_id}`);
                }

                const itemTotal = parseFloat(variant.price) * item.quantity;
                totalAmount += itemTotal;

                orderItems.push({
                    product_variant_id: variant.id,
                    price_at_purchase: variant.price,
                    quantity: item.quantity
                });
            }

            // 3. Validate amount paid matches server-calculated total
            if (parseFloat(amount_paid) !== totalAmount) {
                throw new Error(`Amount paid (${amount_paid}) does not match required total (${totalAmount})`);
            }

            // 4. Insert into orders with custom order_number
            const orderNumRes = await client.query("SELECT nextval('order_number_seq') as num");
            const orderNumber = `APRV26${orderNumRes.rows[0].num}`;

            const orderInsertSql = `
        INSERT INTO orders (full_name, roll_number, phone, email, total_amount, status, order_number)
        VALUES ($1, $2, $3, $4, $5, 'payment_submitted', $6)
        RETURNING id, order_number
      `;
            const orderRes = await client.query(orderInsertSql, [
                full_name, roll_number, phone, email, totalAmount, orderNumber
            ]);
            const orderId = orderRes.rows[0].id;
            const finalOrderNumber = orderRes.rows[0].order_number;

            // 5. Insert into order_items
            for (const item of orderItems) {
                await client.query(
                    `INSERT INTO order_items (order_id, product_variant_id, price_at_purchase, quantity)
           VALUES ($1, $2, $3, $4)`,
                    [orderId, item.product_variant_id, item.price_at_purchase, item.quantity]
                );

                // Bonus: Actually deduct stock
                await client.query(
                    `UPDATE product_variants SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
                    [item.quantity, item.product_variant_id]
                );
            }

            // 6. Insert into payments
            try {
                await client.query(
                    `INSERT INTO payments (order_id, upi_account_id, upi_transaction_id, amount_paid, payment_status)
           VALUES ($1, $2, $3, $4, 'submitted')`,
                    [orderId, upi_account_id, upi_transaction_id, amount_paid]
                );
            } catch (payErr) {
                if (payErr.code === '23505') { // Unique violation for upi_transaction_id
                    const error = new Error('Duplicate transaction ID');
                    error.statusCode = 409;
                    throw error;
                }
                throw payErr;
            }

            await client.query('COMMIT');
            return { order_id: orderId, order_number: finalOrderNumber, status: 'payment_submitted' };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async getOrderById(idOrNumber) {
        // Check if input is likely a formatted order number (e.g., APRV2610001)
        const isFormatted = typeof idOrNumber === 'string' && idOrNumber.startsWith('APRV26');

        const orderSql = `
      SELECT o.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'product_variant_id', oi.product_variant_id,
              'price_at_purchase', oi.price_at_purchase,
              'quantity', oi.quantity
            )
          ) FILTER (WHERE oi.id IS NOT NULL), 
          '[]'
        ) as items,
        p.payment_status,
        p.upi_transaction_id,
        u.upi_id as recipient_upi
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN payments p ON o.id = p.order_id
      LEFT JOIN upi_accounts u ON p.upi_account_id = u.id
      WHERE (o.order_number = $1 OR (o.id::text = $1 AND NOT $2))
      GROUP BY o.id, p.payment_status, p.upi_transaction_id, u.upi_id
    `;
        const result = await pool.query(orderSql, [idOrNumber, isFormatted]);
        return result.rows[0];
    }
};
