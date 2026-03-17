import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import subscriptionsRouter from './routes/subscriptions';
import gmailRouter from './routes/gmail';
import { getDb } from './db/database';
import { startPolling, isGmailConnected } from './services/gmailService';
import { startRenewalScheduler } from './services/renewalService';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json());

// Routes
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/gmail', gmailRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  // Initialize DB on startup
  getDb();
  console.log(`Sub Tracker server running on http://localhost:${PORT}`);

  // Start Gmail polling if already connected
  if (isGmailConnected()) {
    startPolling();
  }

  // Start renewal scheduler (runs on startup + every midnight)
  startRenewalScheduler();
});
