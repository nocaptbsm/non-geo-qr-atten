import { Request, Response, NextFunction } from 'express';
import { AdminService } from '../services/admin.service';

export class AdminController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { username, password } = req.body;
      const { token } = await AdminService.login(username, password);
      res.status(200).json({ success: true, token });
    } catch (error: any) {
      res.status(401).json({ success: false, message: error.message || 'Login failed' });
    }
  }

  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const stats = await AdminService.getTodayStats();
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }

  static async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AdminService.getHistory(req.query);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async exportCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const csvData = await AdminService.exportCSV();
      res.header('Content-Type', 'text/csv');
      res.attachment('attendance_history.csv');
      res.send(csvData);
    } catch (error) {
      next(error);
    }
  }
}
