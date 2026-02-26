import { superadminService } from './superadmin.server.js';

export const listAdmins = async (req, res, next) => {
	try {
		const admins = await superadminService.listAdmins();
		res.json({
			status: 'success',
			data: admins
		});
	} catch (error) {
		next(error);
	}
};

export const activateAdmin = async (req, res, next) => {
	try {
		const { id } = req.params;
		if (isNaN(id)) {
			const error = new Error('Invalid admin ID');
			error.statusCode = 400;
			throw error;
		}

		const admin = await superadminService.activateAdmin(Number(id));
		if (!admin) {
			const error = new Error('Admin not found');
			error.statusCode = 404;
			throw error;
		}

		res.json({
			status: 'success',
			message: 'Admin activated successfully',
			data: admin
		});
	} catch (error) {
		next(error);
	}
};
