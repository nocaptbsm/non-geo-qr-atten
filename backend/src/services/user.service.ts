import prisma from '../config/db';

export class UserService {
  static async registerUser(data: { fullName: string; registrationNo: string; mobileNo: string }) {
    // Check if user already exists by registrationNo or mobileNo
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { registrationNo: data.registrationNo },
          { mobileNo: data.mobileNo }
        ]
      }
    });

    if (existingUser) {
      return { user: existingUser, isNew: false };
    }

    const newUser = await prisma.user.create({
      data: {
        fullName: data.fullName,
        registrationNo: data.registrationNo,
        mobileNo: data.mobileNo,
      }
    });

    return { user: newUser, isNew: true };
  }
}
