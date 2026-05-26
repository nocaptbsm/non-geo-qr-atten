import cron from 'node-cron';
import prisma from '../config/db';

// Run every hour at minute 0
cron.schedule('0 * * * *', async () => {
  console.log('Running cleanup job for expired tokens...');
  try {
    const result = await prisma.qrToken.deleteMany({
      where: {
        OR: [
          { used: true },
          { expiresAt: { lt: new Date() } }
        ]
      }
    });
    console.log(`Cleanup finished: deleted ${result.count} tokens.`);
  } catch (error) {
    console.error('Failed to run cleanup job:', error);
  }
});
