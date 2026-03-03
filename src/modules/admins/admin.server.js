import { pool, query } from '../../config/db.js';
import { sendOrderConfirmationEmail } from '../../utils/email.service.js';

/**
 * Generate a unique 6-character alphanumeric collection code
 * Format: 3 letters + 3 numbers (e.g., ABC123)
 */
async function generateUniqueCollectionCode() {
	const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
	const numbers = '0123456789';
	
	let attempts = 0;
	const maxAttempts = 10;
	
	while (attempts < maxAttempts) {
		// Generate 3 random letters
		let code = '';
		for (let i = 0; i < 3; i++) {
			code += letters.charAt(Math.floor(Math.random() * letters.length));
		}
		// Generate 3 random numbers
		for (let i = 0; i < 3; i++) {
			code += numbers.charAt(Math.floor(Math.random() * numbers.length));
		}
		
		// Check if code already exists
		const checkRes = await query(
			'SELECT id FROM orders WHERE collection_code = $1',
			[code]
		);
		
		if (checkRes.rows.length === 0) {
			return code; // Unique code found
		}
		
		attempts++;
	}
	
	// Fallback: use timestamp-based code if max attempts reached
	const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
	return timestamp.padStart(6, '0');
}

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
	 * Fetch admin by id with password hash (for password verification).
	 */
	async getAdminByIdWithPassword(adminId) {
		const sql = `
			SELECT id, name, email, password_hash, role, is_active, last_login_at, created_at
			FROM admins
			WHERE id = $1
			LIMIT 1
		`;
		const result = await query(sql, [adminId]);
		return result.rows[0] || null;
	},

	/**
	 * Change admin password
	 * @param {number} adminId - Admin ID
	 * @param {string} newPasswordHash - New hashed password
	 * @returns {object|null} Updated admin info
	 */
	async changePassword(adminId, newPasswordHash) {
		const sql = `
			UPDATE admins
			SET password_hash = $1
			WHERE id = $2
			RETURNING id, name, email, role
		`;
		const result = await query(sql, [newPasswordHash, adminId]);
		return result.rows[0] || null;
	},

	/**
	 * List all orders with items and payment info for admin.
	 * @param {string} statusFilter - Optional status filter: 'verified', 'rejected', or undefined for all
	 */
	async listOrdersForAdmin(statusFilter = null) {
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
				u.upi_id,
				COALESCE(
					json_agg(
						json_build_object(
							'id', oi.id,
							'product_variant_id', oi.product_variant_id,
							'product_name', prod.name,
							'variant_size', pv.size,
							'price_at_purchase', oi.price_at_purchase,
							'quantity', oi.quantity
						) ORDER BY oi.id
					) FILTER (WHERE oi.id IS NOT NULL),
					'[]'
				) AS order_items
			FROM orders o
			LEFT JOIN order_items oi ON o.id = oi.order_id
			LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
			LEFT JOIN products prod ON pv.product_id = prod.id
			LEFT JOIN payments p ON o.id = p.order_id
			LEFT JOIN upi_accounts u ON p.upi_account_id = u.id
			${statusFilter ? 'WHERE o.status = $1' : ''}
			GROUP BY o.id, o.order_number, o.full_name, o.roll_number, o.phone, o.total_amount, o.status, p.upi_transaction_id, p.upi_account_id, u.upi_id
			ORDER BY o.created_at DESC
		`;
		
		const result = statusFilter 
			? await query(sql, [statusFilter])
			: await query(sql);
		
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

		// Generate unique collection code
		const collectionCode = await generateUniqueCollectionCode();

		await client.query(
			`UPDATE orders SET status = 'verified', collection_code = $1 WHERE id = $2`,
			[collectionCode, orderId]
		);			await client.query(
				`INSERT INTO audit_logs (admin_id, action_type, entity_type, entity_id, old_status, new_status, ip_address)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[adminId, 'STATUS_UPDATE', 'order', orderId, order.status, 'verified', ipAddress]
			);

			await client.query('COMMIT');

			// Fetch complete order details for email
			try {
			const orderDetailsRes = await client.query(`
				SELECT 
					o.order_number,
					o.collection_code,
					o.full_name,
					o.email,
					o.total_amount,
					COALESCE(
						json_agg(
							json_build_object(
								'product_name', p.name,
								'variant_size', pv.size,
								'quantity', oi.quantity
							) ORDER BY oi.id
						) FILTER (WHERE oi.id IS NOT NULL),
						'[]'
					) as items
				FROM orders o
				LEFT JOIN order_items oi ON o.id = oi.order_id
				LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
				LEFT JOIN products p ON pv.product_id = p.id
				WHERE o.id = $1
				GROUP BY o.id, o.order_number, o.collection_code, o.full_name, o.email, o.total_amount
			`, [orderId]);				const orderDetails = orderDetailsRes.rows[0];
				
				if (orderDetails && orderDetails.email) {
				// Send confirmation email (non-blocking - don't wait for it)
				sendOrderConfirmationEmail({
					email: orderDetails.email,
					fullName: orderDetails.full_name,
					orderNumber: orderDetails.order_number,
					collectionCode: orderDetails.collection_code,
					items: orderDetails.items,
					totalAmount: orderDetails.total_amount
				}).catch(err => {
						console.error('Failed to send confirmation email:', err);
						// Don't throw - email failure shouldn't fail the order verification
					});
				}
			} catch (emailError) {
				console.error('Error preparing confirmation email:', emailError);
				// Continue - email error shouldn't fail the order verification
			}

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
