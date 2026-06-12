import cron from 'node-cron';
import { syncAllUsers } from '../services/sync.js';

const CRON_SCHEDULE = process.env.SYNC_CRON || '0 3 * * *';
const TIMEZONE = process.env.SYNC_TIMEZONE || 'America/Argentina/Buenos_Aires';

export function startDailySyncJob() {
  if (process.env.SYNC_ENABLED === 'false') {
    console.log('Daily sync disabled (SYNC_ENABLED=false)');
    return;
  }

  if (!cron.validate(CRON_SCHEDULE)) {
    console.error(`Invalid SYNC_CRON schedule: ${CRON_SCHEDULE}`);
    return;
  }

  cron.schedule(
    CRON_SCHEDULE,
    async () => {
      console.log(`[cron] Starting daily sync (${CRON_SCHEDULE})`);
      try {
        const result = await syncAllUsers({ triggeredBy: 'cron' });
        console.log(`[cron] Sync finished: ${result.status}, ${result.usersSynced}/${result.usersTotal} users`);
      } catch (err) {
        console.error('[cron] Sync failed:', err.message);
      }
    },
    { timezone: TIMEZONE },
  );

  console.log(`Daily sync scheduled: "${CRON_SCHEDULE}" (${TIMEZONE})`);
}
