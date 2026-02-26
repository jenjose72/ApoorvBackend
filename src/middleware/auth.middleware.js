import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            const error = new Error('No token provided');
            error.statusCode = 401;
            throw error;
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = decoded; // Attach admin data to request
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            error.message = 'Invalid token';
            error.statusCode = 401;
        } else if (error.name === 'TokenExpiredError') {
            error.message = 'Token expired';
            error.statusCode = 401;
        }
        next(error);
    }
};
