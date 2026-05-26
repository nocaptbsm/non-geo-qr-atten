import { Router } from 'express';
import tokenRoutes from './token.routes';
import userRoutes from './user.routes';
import attendanceRoutes from './attendance.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.use('/', tokenRoutes); // /api/generate-token, /api/validate-token/:token
router.use('/', userRoutes); // /api/register
router.use('/', attendanceRoutes); // /api/mark-attendance
router.use('/admin', adminRoutes); // /api/admin/...

export default router;
