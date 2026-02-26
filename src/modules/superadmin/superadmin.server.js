import { query } from '../../config/db.js';

export const superadminService = {
	async listAdmins() {
		const sql = `
			SELECT id, name, email, role, is_active, last_login_at, created_at
			FROM admins
			ORDER BY created_at DESC
		`;
		const result = await query(sql);
		return result.rows;
	},

	async activateAdmin(adminId) {
		const sql = `
			UPDATE admins
			SET is_active = TRUE
			WHERE id = $1
			RETURNING id, name, email, role, is_active, last_login_at, created_at
		`;
		const result = await query(sql, [adminId]);
		return result.rows[0] || null;
	}
};
