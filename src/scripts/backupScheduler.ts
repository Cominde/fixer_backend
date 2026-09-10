require('dotenv').config();
const cron = require('node-cron');
const { backupDatabase } = require('./backupDatabase');

/**
 * Backup Scheduler
 * Runs database backup daily at 2:00 AM
 */

// Schedule backup to run daily at 2:00 AM
const backupJob = cron.schedule('0 2 * * *', async () => {
  console.log('=== Scheduled Backup Started ===');
  try {
    await backupDatabase();
    console.log('=== Scheduled Backup Completed ===');
  } catch (error) {
    console.error('=== Scheduled Backup Failed ===', error);
  }
}, {
  scheduled: true,
  timezone: process.env.TIMEZONE || 'Africa/Cairo'
});

console.log('Backup scheduler started. Next backup will run at 2:00 AM daily.');
console.log('Timezone:', process.env.TIMEZONE || 'Africa/Cairo');

// Allow manual trigger
if (process.argv.includes('--run-now')) {
  console.log('Running backup immediately...');
  backupDatabase()
    .then(() => {
      console.log('Manual backup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Manual backup failed:', error);
      process.exit(1);
    });
}

export = { backupJob };
