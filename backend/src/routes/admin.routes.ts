import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.post('/login', AdminController.login);

// Protected Routes
router.use(authenticateAdmin);
router.get('/stats', AdminController.getStats);
router.get('/history', AdminController.getHistory);
router.get('/export', AdminController.exportCSV);

export default router;
