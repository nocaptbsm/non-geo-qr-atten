import { Router } from 'express';
import { AttendanceController } from '../controllers/attendance.controller';

const router = Router();

router.post('/mark-attendance', AttendanceController.markAttendance);

export default router;
