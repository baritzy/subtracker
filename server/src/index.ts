import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import subscriptionsRouter from './routes/subscriptions';
import gmailRouter from './routes/gmail';
import authRouter from './routes/auth';
import pushRouter from './routes/push';
import { initDb } from './db/database';

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

  // Digital Asset Links — required for TWA verification and push notification delegation
  app.get('/.well-known/assetlinks.json', (_req, res) => {
    res.json([{
      relation: ['delegate_permission/common.handle_all_urls', 'delegate_permission/common.get_login_creds'],
      target: {
        namespace: 'android_app',
        package_name: 'com.onrender.subtracker_nm4n.twa',
        sha256_cert_fingerprints: [
          '1E:08:A9:03:AE:F9:C3:A7:21:51:0B:64:EC:76:4D:01:D3:D0:94:EB:95:41:61:B6:25:44:EA:8F:18:7B:59:53',
        ],
      },
    }]);
  });

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

    // Gmail sync is on-demand only (user triggers it manually)
    // No automatic polling — saves Neon compute hours

    // Start renewal scheduler (runs on startup + every midnight)
    startRenewalScheduler();

    // Start push notification scheduler (runs every 15 minutes)
    startPushScheduler();
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
