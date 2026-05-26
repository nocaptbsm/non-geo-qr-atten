import { Request, Response, NextFunction } from 'express';
import { AttendanceService } from '../services/attendance.service';

export class AttendanceController {
  static async markAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, token } = req.body;

      if (!userId || !token) {
        return res.status(400).json({ success: false, message: 'Missing userId or token' });
      }

      const result = await AttendanceService.markAttendance(userId, token);

      res.status(200).json({
        success: true,
        status: result.status,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to mark attendance'
      });
    }
  }
}
