import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../services/token.service';

export class TokenController {
  static async generateToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { deviceId } = req.query;
      const tokenData = await TokenService.generateToken(deviceId as string | undefined);
      
      res.status(201).json({
        success: true,
        data: tokenData,
      });
    } catch (error) {
      next(error);
    }
  }

  static async validateToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      await TokenService.validateToken(token as string);
      
      res.status(200).json({
        success: true,
        message: 'Token is valid',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Invalid token',
      });
    }
  }
}
