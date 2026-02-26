import { pool, query } from '../../config/db.js';

export const adminService = {
	/**
	 * Register a new admin.
	 * Expects password to be pre-hashed by the controller.
	 */
	async registerAdmin({ name, email, passwordHash, role = 'normal_admin', isActive = false }) {
		const sql = `
			INSERT INTO admins (name, email, password_hash, role, is_active)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (email) DO NOTHING
			RETURNING id, name, email, role, is_active, created_at
		`;
		const result = await query(sql, [name, email, passwordHash, role, isActive]);
		return result.rows[0] || null;
	},

	/**
	 * Fetch admin by email for login.
	 * Includes password_hash for credential verification.
	 */
	async getAdminByEmail(email) {
		const sql = `
			SELECT id, name, email, password_hash, role, is_active, last_login_at, created_at
			FROM admins
			WHERE email = $1
			LIMIT 1
		`;
		const result = await query(sql, [email]);
		return result.rows[0] || null;
	},

	/**
	 * Update last login timestamp.
	 */
	async updateLastLogin(adminId) {
		const sql = `
			UPDATE admins
			SET last_login_at = NOW()
			WHERE id = $1
			RETURNING id, last_login_at
		`;
		const result = await query(sql, [adminId]);
		return result.rows[0] || null;
	},

	/**
	 * Fetch admin by id (without password hash).
	 */
	async getAdminById(adminId) {
		const sql = `
			SELECT id, name, email, role, is_active, last_login_at, created_at
			FROM admins
			WHERE id = $1
			LIMIT 1
		`;
		const result = await query(sql, [adminId]);
		return result.rows[0] || null;
	},

	/**
	 * List all orders with items and payment info for admin.
	 */
	async listOrdersForAdmin() {
		const sql = `
			SELECT
				o.id AS order_id,
				o.order_number,
				o.full_name,
				o.roll_number,
				o.phone,
				o.total_amount,
				o.status,
				p.upi_transaction_id,
				p.upi_account_id,
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
				) AS order_items
			FROM orders o
			LEFT JOIN order_items oi ON o.id = oi.order_id
			LEFT JOIN payments p ON o.id = p.order_id
			GROUP BY o.id, o.order_number, o.full_name, o.roll_number, o.phone, o.total_amount, o.status, p.upi_transaction_id, p.upi_account_id
			ORDER BY o.created_at DESC
		`;
		const result = await query(sql);
		return result.rows;
	},

	/**
	 * Verify order and write audit log.
	 */
	async verifyOrderStatus(orderId, adminId, ipAddress) {
		const client = await pool.connect();
		try {
			await client.query('BEGIN');

			const selectRes = await client.query(
				`SELECT id, status FROM orders WHERE id = $1 FOR UPDATE`,
				[orderId]
			);
			const order = selectRes.rows[0];
			if (!order) {
				const error = new Error('Order not found');
				error.statusCode = 404;
				throw error;
			}

			const adminRes = await client.query(
				`SELECT role FROM admins WHERE id = $1`,
				[adminId]
			);
			const admin = adminRes.rows[0];
			if (!admin) {
				const error = new Error('Admin not found');
				error.statusCode = 404;
				throw error;
			}

			if (order.status !== 'payment_submitted' && admin.role !== 'super_admin') {
				const error = new Error('Order status is not payment_submitted');
				error.statusCode = 400;
				throw error;
			}

			await client.query(
				`UPDATE orders SET status = 'verified' WHERE id = $1`,
				[orderId]
			);

			await client.query(
				`INSERT INTO audit_logs (admin_id, action_type, entity_type, entity_id, old_status, new_status, ip_address)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[adminId, 'STATUS_UPDATE', 'order', orderId, order.status, 'verified', ipAddress]
			);

			await client.query('COMMIT');
			return { order_id: orderId, status: 'verified' };
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	},

	/**
	 * Reject order and write audit log (orders table only).
	 */
	async rejectOrderStatus(orderId, adminId, ipAddress, reason = null) {
		const client = await pool.connect();
		try {
			await client.query('BEGIN');

			const selectRes = await client.query(
				`SELECT id, status FROM orders WHERE id = $1 FOR UPDATE`,
				[orderId]
			);
			const order = selectRes.rows[0];
			if (!order) {
				const error = new Error('Order not found');
				error.statusCode = 404;
				throw error;
			}

			const adminRes = await client.query(
				`SELECT role FROM admins WHERE id = $1`,
				[adminId]
			);
			const admin = adminRes.rows[0];
			if (!admin) {
				const error = new Error('Admin not found');
				error.statusCode = 404;
				throw error;
			}

			if (order.status !== 'payment_submitted' && admin.role !== 'super_admin') {
				const error = new Error('Order status is not payment_submitted');
				error.statusCode = 400;
				throw error;
			}

			await client.query(
				`UPDATE orders SET status = 'rejected' WHERE id = $1`,
				[orderId]
			);

			await client.query(
				`INSERT INTO audit_logs (admin_id, action_type, entity_type, entity_id, old_status, new_status, ip_address)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[adminId, 'STATUS_UPDATE', 'order', orderId, order.status, 'rejected', ipAddress]
				);

			await client.query('COMMIT');
			return { order_id: orderId, status: 'rejected', reason };
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	}


};
