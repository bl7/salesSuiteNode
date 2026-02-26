import cron from 'node-cron';
import { attendanceRepository } from '../modules/attendance/attendance.repository';

export function startAttendanceCronJobs() {
  // Run every day at 11:30 PM Nepal time
  cron.schedule('30 23 * * *', async () => {
    console.log('[CRON] Running auto clock-out job at 11:30 PM Nepal Time');
    try {
      const updatedCount = await attendanceRepository.autoClockOutAll();
      console.log(`[CRON] Auto clocked out ${updatedCount} active logs.`);
    } catch (error) {
      console.error('[CRON] Error during auto clock-out job:', error);
    }
  }, {
    timezone: 'Asia/Kathmandu'
  });
}
