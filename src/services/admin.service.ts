import prisma from '../config/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import { createObjectCsvStringifier } from 'csv-writer';

config();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

export class AdminService {
  static async login(username: string, passwordPlain: string) {
    const admin = await prisma.admin.findUnique({ where: { username } });
    if (!admin) throw new Error('Invalid credentials');

    const isMatch = await bcrypt.compare(passwordPlain, admin.passwordHash);
    if (!isMatch) throw new Error('Invalid credentials');

    const token = jwt.sign({ id: admin.id }, JWT_SECRET, { expiresIn: '1d' });
    return { token };
  }

  static async getTodayStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totalAttendance = await prisma.attendanceLog.count({
      where: {
        checkInTime: {
          gte: today,
        },
      },
    });

    const activeUsers = await prisma.attendanceLog.count({
      where: {
        checkOutTime: null,
      },
    });

    return { totalAttendance, activeUsers };
  }

  static async getHistory(query: { registrationNo?: string; limit?: number; offset?: number }) {
    const { registrationNo, limit = 50, offset = 0 } = query;

    const whereClause: any = {};
    if (registrationNo) {
      whereClause.user = { registrationNo: { contains: registrationNo, mode: 'insensitive' } };
    }

    const history = await prisma.attendanceLog.findMany({
      where: whereClause,
      include: {
        user: { select: { fullName: true, registrationNo: true } },
      },
      orderBy: { checkInTime: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const total = await prisma.attendanceLog.count({ where: whereClause });

    return { history, total };
  }

  static async exportCSV() {
    const logs = await prisma.attendanceLog.findMany({
      include: { user: true },
      orderBy: { checkInTime: 'desc' },
    });

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'fullName', title: 'Full Name' },
        { id: 'registrationNo', title: 'Registration No' },
        { id: 'checkInTime', title: 'Check-In Time' },
        { id: 'checkOutTime', title: 'Check-Out Time' },
      ],
    });

    const records = logs.map(log => ({
      fullName: log.user.fullName,
      registrationNo: log.user.registrationNo,
      checkInTime: log.checkInTime.toISOString(),
      checkOutTime: log.checkOutTime ? log.checkOutTime.toISOString() : 'Active',
    }));

    const header = csvStringifier.getHeaderString();
    const data = csvStringifier.stringifyRecords(records);

    return header + data;
  }
}
