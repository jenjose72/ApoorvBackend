import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { adminService } from './admin.server.js';

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const sanitizeEmail = (value) => sanitizeString(value).toLowerCase();
const sanitizeRole = (value) => sanitizeString(value).toLowerCase();
const ALLOWED_ROLES = new Set(['normal_admin', 'super_admin']);

const csvEscape = (value) => {
    if (value === null || value === undefined) return '';

    const stringValue =
        typeof value === 'string'
            ? value
            : typeof value === 'object'
                ? JSON.stringify(value)
                : String(value);

    const escaped = stringValue.replace(/"/g, '""');
    return `"${escaped}"`;
};

const buildOrdersCsv = (orders) => {
    const headers = [
        'order_id',
        'order_number',
        'full_name',
        'roll_number',
        'phone',
        'total_amount',
        'status',
        'upi_transaction_id',
        'upi_account_id',
        'upi_id',
        'order_items'
    ];

    const rows = orders.map((order) => [
        order.order_id,
        order.order_number,
        order.full_name,
        order.roll_number,
        order.phone,
        order.total_amount,
        order.status,
        order.upi_transaction_id,
        order.upi_account_id,
        order.upi_id,
        order.order_items
    ]);

    const csvRows = [
        headers.map(csvEscape).join(','),
        ...rows.map((row) => row.map(csvEscape).join(','))
    ];

    return csvRows.join('\n');
};

export const registerAdmin = async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;

        const sanitizedName = sanitizeString(name);
        const sanitizedEmail = sanitizeEmail(email);
        const sanitizedRole = sanitizeRole(role);
        const passwordValue = typeof password === 'string' ? password.trim() : '';

        const safeRole = ALLOWED_ROLES.has(sanitizedRole) ? sanitizedRole : undefined;

        if (!sanitizedName || !sanitizedEmail || !passwordValue) {
            const error = new Error('Name, email, and password are required');
            error.statusCode = 400;
            throw error;
        }

        const passwordHash = await bcrypt.hash(passwordValue, 10);
        const admin = await adminService.registerAdmin({
            name: sanitizedName,
            email: sanitizedEmail,
            passwordHash,
            role: safeRole,
            isActive: false
        });

        if (!admin) {
            const error = new Error('Admin already exists');
            error.statusCode = 409;
            throw error;
        }

        res.status(201).json({
            status: 'success',
            message: 'Admin registered successfully',
            data: admin
        });
    } catch (error) {
        next(error);
    }
};

export const loginAdmin = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const sanitizedEmail = sanitizeEmail(email);
        const passwordValue = typeof password === 'string' ? password.trim() : '';

        if (!sanitizedEmail || !passwordValue) {
            const error = new Error('Email and password are required');
            error.statusCode = 400;
            throw error;
        }

        const admin = await adminService.getAdminByEmail(sanitizedEmail);
        if (!admin) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        const isMatch = await bcrypt.compare(passwordValue, admin.password_hash);
        if (!isMatch) {
            const error = new Error('Invalid credentials');
            error.statusCode = 401;
            throw error;
        }

        if (!admin.is_active) {
            const error = new Error('Admin is not active');
            error.statusCode = 403;
            throw error;
        }

        await adminService.updateLastLogin(admin.id);

        const token = jwt.sign(
            { id: admin.id, role: admin.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            status: 'success',
            token
        });
    } catch (error) {
        next(error);
    }
};

export const listOrdersForAdmin = async (req, res, next) => {
    try {
        const orders = await adminService.listOrdersForAdmin();
        res.json({
            status: 'success',
            data: orders
        });
    } catch (error) {
        next(error);
    }
};

export const downloadOrdersCsv = async (req, res, next) => {
    try {
        // Get status filter from query params: 'all', 'verified', 'rejected'
        const statusFilter = req.query.status;
        let filterValue = null;
        let filenameSuffix = 'all';

        if (statusFilter === 'verified') {
            filterValue = 'verified';
            filenameSuffix = 'verified';
        } else if (statusFilter === 'rejected') {
            filterValue = 'rejected';
            filenameSuffix = 'rejected';
        }

        const orders = await adminService.listOrdersForAdmin(filterValue);
        const csv = buildOrdersCsv(orders);

        const now = new Date();
        const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const filename = `admin-orders-${filenameSuffix}-${dateStamp}.csv`;

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csv);
    } catch (error) {
        next(error);
    }
};

export const getDashboardStats = async (req, res, next) => {
    try {
        const stats = await adminService.getDashboardStats();
        res.json({ status: 'success', data: stats });
    } catch (error) {
        next(error);
    }
};

export const verifyCollectionCode = async (req, res, next) => {
    try {
        const adminId = req.admin?.id;
        if (!adminId) {
            const error = new Error('Unauthorized');
            error.statusCode = 401;
            throw error;
        }

        const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
        if (!code) {
            const error = new Error('Collection code is required');
            error.statusCode = 400;
            throw error;
        }

        // Basic format check: 6 alphanumeric chars
        if (!/^[A-Z0-9]{6}$/.test(code)) {
            const error = new Error('Invalid collection code format');
            error.statusCode = 400;
            throw error;
        }

        const result = await adminService.verifyCollectionCode(code, adminId, req.ip);

        res.json({
            status: 'success',
            message: 'Collection verified successfully',
            data: result,
        });
    } catch (error) {
        next(error);
    }
};

export const verifyOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (isNaN(id)) {
            const error = new Error('Invalid order ID');
            error.statusCode = 400;
            throw error;
        }

        const adminId = req.admin?.id;
        if (!adminId) {
            const error = new Error('Unauthorized');
            error.statusCode = 401;
            throw error;
        }

        const result = await adminService.verifyOrderStatus(
            Number(id),
            adminId,
            req.ip
        );

        res.json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const rejectOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (isNaN(id)) {
            const error = new Error('Invalid order ID');
            error.statusCode = 400;
            throw error;
        }

        const adminId = req.admin?.id;
        if (!adminId) {
            const error = new Error('Unauthorized');
            error.statusCode = 401;
            throw error;
        }

        const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : null;

        const result = await adminService.rejectOrderStatus(
            Number(id),
            adminId,
            req.ip,
            reason
        );

        res.json({
            status: 'success',
            data: result
        });
    } catch (error) {
        next(error);
    }
};

export const changePassword = async (req, res, next) => {
    try {
        const adminId = req.admin?.id;
        if (!adminId) {
            const error = new Error('Unauthorized');
            error.statusCode = 401;
            throw error;
        }

        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword || !confirmPassword) {
            const error = new Error('All password fields are required');
            error.statusCode = 400;
            throw error;
        }

        // Check new password length
        if (newPassword.length < 8) {
            const error = new Error('New password must be at least 8 characters');
            error.statusCode = 400;
            throw error;
        }

        // Check passwords match
        if (newPassword !== confirmPassword) {
            const error = new Error('New password and confirmation do not match');
            error.statusCode = 400;
            throw error;
        }

        // Check new password is different from current
        if (currentPassword === newPassword) {
            const error = new Error('New password must be different from current password');
            error.statusCode = 400;
            throw error;
        }

        // Get admin with password hash
        const admin = await adminService.getAdminByIdWithPassword(adminId);
        if (!admin) {
            const error = new Error('Admin not found');
            error.statusCode = 404;
            throw error;
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, admin.password_hash);
        if (!isValidPassword) {
            const error = new Error('Current password is incorrect');
            error.statusCode = 401;
            throw error;
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10);

        // Update password
        const result = await adminService.changePassword(adminId, newPasswordHash);

        res.json({
            status: 'success',
            message: 'Password changed successfully',
            data: result
        });
    } catch (error) {
        next(error);
    }
};
