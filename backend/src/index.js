import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import './db/cards.js';
import { startDailySyncJob } from './jobs/dailySync.js';
import searchRouter from './routes/search.js';
import { syncAllUsers, syncMissingUsers } from './services/sync.js';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
  }),
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/search', searchRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`MTG Collection Search API running on http://localhost:${PORT}`);
  startDailySyncJob();

  if (process.env.SYNC_ON_START === 'true') {
    console.log('Running full sync (SYNC_ON_START=true)...');
    syncAllUsers({ triggeredBy: 'startup' }).catch((err) => {
      console.error('Initial sync failed:', err.message);
    });
  } else if (process.env.SYNC_MISSING_ON_START !== 'false') {
    syncMissingUsers({ triggeredBy: 'startup' }).then((result) => {
      if (result.usersTotal > 0) {
        console.log(`Synced missing members: ${result.usersSynced}/${result.usersTotal}`);
      }
    }).catch((err) => {
      console.error('Missing member sync failed:', err.message);
    });
  }
});
