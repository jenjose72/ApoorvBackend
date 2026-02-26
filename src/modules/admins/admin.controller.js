import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { adminService } from './admin.server.js';

const sanitizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const sanitizeEmail = (value) => sanitizeString(value).toLowerCase();
const sanitizeRole = (value) => sanitizeString(value).toLowerCase();
const ALLOWED_ROLES = new Set(['normal_admin', 'super_admin']);

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
