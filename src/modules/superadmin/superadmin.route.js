import { Router } from 'express';
import { listAdmins, activateAdmin } from './superadmin.controller.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';

const router = Router();

router.use(verifyToken, requireRole('superadmin'));

router.get('/admins', listAdmins);
router.patch('/admins/:id/activate', activateAdmin);

export default router;
