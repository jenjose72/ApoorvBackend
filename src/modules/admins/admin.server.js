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
	 * Verify a collection code during merch distribution.
	 * One-time use: marks the order as collected and logs the action.
	 * @param {string} code - The 6-char alphanumeric collection code
	 * @param {number} adminId - ID of the admin doing the verification
	 * @param {string} ipAddress - Admin's IP for audit log
	 */
	async verifyCollectionCode(code, adminId, ipAddress) {
		const client = await pool.connect();
		try {
			await client.query('BEGIN');

			// 1. Lock the order row first (FOR UPDATE is incompatible with GROUP BY)
			const lockRes = await client.query(
				`SELECT id, order_number, full_name, roll_number, phone, email,
				        total_amount, status, collected_at, collected_by
				 FROM orders
				 WHERE collection_code = $1
				 FOR UPDATE`,
				[code.toUpperCase()]
			);

			if (lockRes.rows.length === 0) {
				const err = new Error('Invalid collection code');
				err.statusCode = 404;
				throw err;
			}

			const order = lockRes.rows[0];

			// 1b. Fetch items separately now that the row is locked
			const itemsRes = await client.query(
				`SELECT prod.name AS product_name, pv.size AS variant_size, oi.quantity
				 FROM order_items oi
				 JOIN product_variants pv ON oi.product_variant_id = pv.id
				 JOIN products prod ON pv.product_id = prod.id
				 WHERE oi.order_id = $1
				 ORDER BY oi.id`,
				[order.id]
			);
			order.items = itemsRes.rows;

			// 2. Must be a verified order
			if (order.status !== 'verified') {
				const err = new Error('This order is not approved for collection');
				err.statusCode = 400;
				throw err;
			}

			// 3. One-time use check
			if (order.collected_at !== null) {
				// Fetch admin name who already collected it
				const prevAdminRes = await client.query(
					`SELECT name FROM admins WHERE id = $1`,
					[order.collected_by]
				);
				const prevAdmin = prevAdminRes.rows[0]?.name || 'Unknown admin';
				const when = new Date(order.collected_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
				const err = new Error(`Already collected on ${when} by ${prevAdmin}`);
				err.statusCode = 409;
				throw err;
			}

			// 4. Mark as collected
			await client.query(
				`UPDATE orders SET collected_at = NOW(), collected_by = $1 WHERE id = $2`,
				[adminId, order.id]
			);

			// 5. Write audit log
			await client.query(
				`INSERT INTO audit_logs (admin_id, action_type, entity_type, entity_id, old_status, new_status, ip_address)
				 VALUES ($1, 'COLLECTION_VERIFIED', 'order', $2, 'verified', 'collected', $3)`,
				[adminId, order.id, ipAddress]
			);

			await client.query('COMMIT');

			return {
				order_id: order.id,
				order_number: order.order_number,
				full_name: order.full_name,
				roll_number: order.roll_number,
				phone: order.phone,
				email: order.email,
				total_amount: order.total_amount,
				items: order.items,
				collected_at: new Date().toISOString(),
			};
		} catch (error) {
			await client.query('ROLLBACK');
			throw error;
		} finally {
			client.release();
		}
	},

	/**
	 * Compute dashboard statistics for admin panel
	 * Returns counts, total revenue (verified), revenue split by UPI id, and orders split by product
	 */
	async getDashboardStats() {
		// 1) counts + total item count
		const countsSql = `
			SELECT
				COUNT(*)::int AS total,
				COUNT(*) FILTER (WHERE status = 'payment_submitted')::int AS pending,
				COUNT(*) FILTER (WHERE status = 'verified')::int AS verified,
				COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
				COALESCE((
					SELECT SUM(oi.quantity)::int
					FROM order_items oi
					JOIN orders o2 ON oi.order_id = o2.id
					WHERE o2.status = 'verified'
				), 0) AS total_items
			FROM orders o
		`;
		const countsRes = await query(countsSql);
		const counts = countsRes.rows[0] || { total: 0, pending: 0, verified: 0, rejected: 0 };

		// 2) total revenue from verified orders
		const revenueSql = `
			SELECT COALESCE(SUM(total_amount), 0)::numeric AS total_revenue
			FROM orders
			WHERE status = 'verified'
		`;
		const revenueRes = await query(revenueSql);
		const totalRevenue = parseFloat(revenueRes.rows[0]?.total_revenue || 0);

		// 3) revenue split by UPI id (sum of payments.amount_paid for verified orders)
		const revenueByUpiSql = `
			SELECT u.upi_id, COALESCE(SUM(p.amount_paid),0)::numeric AS total
			FROM payments p
			JOIN orders o ON p.order_id = o.id
			LEFT JOIN upi_accounts u ON p.upi_account_id = u.id
			WHERE o.status = 'verified'
			GROUP BY u.upi_id
			ORDER BY total DESC
		`;
		const revenueByUpiRes = await query(revenueByUpiSql);

		// 4) orders / items / revenue split by merch (product)
		const ordersByMerchSql = `
			SELECT prod.name AS product_name,
				COUNT(DISTINCT o.id)::int AS orders_count,
				SUM(oi.quantity)::int AS items_count,
				COALESCE(SUM(oi.quantity * oi.price_at_purchase),0)::numeric AS revenue
			FROM orders o
			JOIN order_items oi ON o.id = oi.order_id
			JOIN product_variants pv ON oi.product_variant_id = pv.id
			JOIN products prod ON pv.product_id = prod.id
			WHERE o.status = 'verified'
			GROUP BY prod.name
			ORDER BY orders_count DESC
		`;
		const ordersByMerchRes = await query(ordersByMerchSql);

		return {
			counts,
			totalRevenue,
			revenueByUpi: revenueByUpiRes.rows,
			ordersByMerch: ordersByMerchRes.rows,
		};
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
