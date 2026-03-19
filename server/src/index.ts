import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import subscriptionsRouter from './routes/subscriptions';
import gmailRouter from './routes/gmail';
import authRouter from './routes/auth';
import pushRouter from './routes/push';
import { initDb } from './db/database';
import { startPolling, isGmailConnected } from './services/gmailService';
import { startRenewalScheduler } from './services/renewalService';
import { startPushScheduler } from './services/pushScheduler';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/gmail', gmailRouter);
app.use('/api/push', pushRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    // Don't serve index.html for asset requests — return 404 so the browser
    // shows a clear error instead of a MIME-type mismatch when SW serves stale HTML
    if (req.path.startsWith('/assets/') || req.path.startsWith('/icons/')) {
      return res.status(404).send('Not found');
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start(): Promise<void> {
  await initDb();

  app.listen(PORT, async () => {
    console.log(`Sub Tracker server running on http://localhost:${PORT}`);

    // Start Gmail polling if already connected
    if (await isGmailConnected()) {
      startPolling();
    }

    // Start renewal scheduler (runs on startup + every midnight)
    startRenewalScheduler();

    // Start push notification scheduler (runs every 10 minutes)
    startPushScheduler();
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
