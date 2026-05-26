import prisma from '../config/db';
import { TokenService } from './token.service';

export class AttendanceService {
  static async markAttendance(userId: string, tokenString: string) {
    // 1. Validate token again
    const qrToken = await TokenService.validateToken(tokenString);

    // 2. Check latest attendance record
    const latestRecord = await prisma.attendanceLog.findFirst({
      where: { userId },
      orderBy: { checkInTime: 'desc' }
    });

    let status: 'IN' | 'OUT';

    // 3. Determine if CHECK IN or CHECK OUT
    if (!latestRecord || latestRecord.checkOutTime) {
      // No active session -> Mark CHECK IN
      await prisma.attendanceLog.create({
        data: {
          userId,
          tokenId: qrToken.id,
          deviceId: qrToken.deviceId,
        }
      });
      status = 'IN';
    } else {
      // Active session -> Mark CHECK OUT
      await prisma.attendanceLog.update({
        where: { id: latestRecord.id },
        data: {
          checkOutTime: new Date(),
        }
      });
      status = 'OUT';
    }

    // 5. Mark token as used
    await prisma.qrToken.update({
      where: { id: qrToken.id },
      data: { used: true }
    });

    return { status };
  }
}
