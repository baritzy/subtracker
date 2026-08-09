import 'dotenv/config';

// Process-level crash safety net. Several async route handlers in this
// codebase (see routes/*.ts — an audit found roughly a dozen) do not wrap
// their body in try/catch. A thrown/rejected error inside one of those
// becomes an unhandled rejection at the Node process level, not an Express
// error — Express 4 (this app's version) does not catch rejections from
// async handlers, so nothing here stops Node's default behavior of crashing
// the whole process over it. This already happened once in production
// (2026-07-19, POST /api/premium/verify threw on every call due to a
// Postgres type mismatch, crashing the server for all users on a single
// bad request).
//
// This is registered before any other import/module runs, so it is armed
// during initDb() at startup too, not just during request handling.
//
// Deliberate trade-off, not an oversight: Node's own docs say a process
// should ideally restart after an uncaughtException, since the error can
// leave in-flight state undefined. We are choosing to log loudly and stay
// up anyway, because for this app a logged error with the other ~97 users
// still being served beats a hard outage with nobody on call to restart it.
// The real fix is wrapping the individual handlers (tracked as follow-up
// work); this net does not replace that, it only limits the blast radius
// until it's done.
process.on('unhandledRejection', (reason) => {
  console.error(
    '[FATAL-CAUGHT] Unhandled promise rejection (process kept alive):',
    reason instanceof Error ? reason.stack ?? reason.message : reason
  );
});

process.on('uncaughtException', (err) => {
  console.error(
    '[FATAL-CAUGHT] Uncaught exception (process kept alive):',
    err instanceof Error ? err.stack ?? err.message : err
  );
});

import express from 'express';
import cors from 'cors';
import path from 'path';
import subscriptionsRouter from './routes/subscriptions';
import gmailRouter from './routes/gmail';
import authRouter from './routes/auth';
import pushRouter from './routes/push';
import receiptRouter from './routes/receipt';
import premiumRouter from './routes/premium';
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
app.use('/api/receipt', receiptRouter);
app.use('/api/premium', premiumRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Privacy Policy
app.get('/privacy', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/privacy.html'));
});

// app-ads.txt — required by AdMob to verify ad inventory ownership.
// Must be registered before the SPA catch-all ('*') below, and must NOT
// go through express.static(clientDist) (there is no such file in the
// client build, so that would fall through to the catch-all's index.html).
app.get('/app-ads.txt', (_req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(__dirname, '../public/app-ads.txt'));
});

// Serve static logos (hosted on our server, not dependent on external URLs)
app.use('/logos', express.static(path.join(__dirname, '../public/logos')));

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

    // Start push notification scheduler (runs every 30 minutes)
    startPushScheduler();
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

