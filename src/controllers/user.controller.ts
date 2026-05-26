import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';

export class UserController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { fullName, registrationNo, mobileNo } = req.body;

      if (!fullName || !registrationNo || !mobileNo) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }

      const result = await UserService.registerUser({ fullName, registrationNo, mobileNo });

      res.status(result.isNew ? 201 : 200).json({
        success: true,
        message: result.isNew ? 'User registered successfully' : 'User already exists',
        data: result.user
      });
    } catch (error) {
      next(error);
    }
  }
}
