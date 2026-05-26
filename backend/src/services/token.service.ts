import prisma from '../config/db';
import crypto from 'crypto';

export class TokenService {
  static async generateToken(deviceId?: string) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 1000); // 15 seconds from now

    const qrToken = await prisma.qrToken.create({
      data: {
        token,
        expiresAt,
        deviceId,
      },
    });

    return {
      token: qrToken.token,
      expiresAt: qrToken.expiresAt,
    };
  }

  static async validateToken(tokenString: string) {
    const qrToken = await prisma.qrToken.findUnique({
      where: { token: tokenString },
    });

    if (!qrToken) {
      throw new Error('Token not found');
    }

    if (qrToken.used) {
      throw new Error('Token already used');
    }

    if (new Date() > qrToken.expiresAt) {
      throw new Error('Token expired');
    }

    return qrToken;
  }
}
