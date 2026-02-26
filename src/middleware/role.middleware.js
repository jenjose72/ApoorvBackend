export const requireRole = (...roles) => (req, res, next) => {
	try {
		const role = req.admin?.role;
		if (!role) {
			const error = new Error('Unauthorized');
			error.statusCode = 401;
			throw error;
		}

		if (!roles.includes(role)) {
			const error = new Error('Forbidden');
			error.statusCode = 403;
			throw error;
		}

		next();
	} catch (error) {
		next(error);
	}
};
