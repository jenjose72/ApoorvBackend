import { query } from '../../config/db.js';

export const getUpiAccount = async (req, res, next) => {
    try {
        // 1. Ensure the sequence exists for persistent round-robin
        await query(`CREATE SEQUENCE IF NOT EXISTS upi_rotation_seq`);

        // 2. Count active UPI accounts
        const countRes = await query(`SELECT count(*) FROM upi_accounts WHERE is_active = true`);
        const count = parseInt(countRes.rows[0].count);

        if (count === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'No active UPI accounts found in Database'
            });
        }

        // 3. Fetch the account using OFFSET with sequence rotation
        const sql = `
            SELECT id, upi_id 
            FROM upi_accounts 
            WHERE is_active = true 
            ORDER BY id 
            OFFSET (nextval('upi_rotation_seq') - 1) % $1 
            LIMIT 1
        `;
        const result = await query(sql, [count]);

        if (!result || !result.rows || result.rows.length === 0) {
            throw new Error('Rotation logic failed to return an account');
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('getUpiAccount Error:', error);
        // Explicitly send JSON error to avoid "Something went wrong" obfuscation
        res.status(500).json({
            status: 'error',
            message: error.message || 'Internal Server Error'
        });
    }
};
