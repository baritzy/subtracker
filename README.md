# Sub Tracker

Track all your subscriptions in one place. Auto-detects new subscriptions from Gmail, shows renewal dates, and provides direct cancel links.

## Quick Start

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure server

```bash
cd server
cp .env.example .env
```

Edit `.env` — the app works without Gmail credentials (manual tracking only).

### 3. Run the app

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```

Open **http://localhost:5173**

---

## Gmail Auto-Detection (optional)

To automatically detect subscriptions from your Gmail inbox:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project → **Enable Gmail API**
3. Create **OAuth 2.0 credentials** (Web application)
4. Add `http://localhost:3001/api/gmail/callback` as an authorized redirect URI
5. Add your Gmail address as a **test user** (OAuth consent screen → Test users)
6. Copy Client ID and Secret into `server/.env`
7. Click **Connect Gmail** in the app

The app polls for new subscription emails every 15 minutes. It only reads emails — it never modifies or sends anything. Gmail-detected subscriptions appear in a **pending review** panel for you to confirm before they're added to your active list.

---

## How Cancel Links Work

- **Known services** (Netflix, Spotify, Adobe, etc.) — cancel URL is pre-filled automatically
- **Gmail-detected** — the app tries to extract a cancel link from the email body
- **Manual entries** — paste the cancel URL in the form, or add it later via Edit

Clicking "Cancel Subscription" **opens the provider's cancellation page in a new tab** and then asks you to confirm. The app never cancels subscriptions on your behalf.

---

## API

Server runs on `http://localhost:3001`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/subscriptions` | List all (optional `?status=active\|cancelled\|pending`) |
| POST | `/api/subscriptions` | Add subscription |
| PUT | `/api/subscriptions/:id` | Update subscription |
| POST | `/api/subscriptions/:id/cancel` | Mark as cancelled |
| POST | `/api/subscriptions/:id/confirm` | Confirm pending (Gmail-detected) |
| DELETE | `/api/subscriptions/:id` | Delete |
| GET | `/api/gmail/status` | Gmail connection status |
| GET | `/api/gmail/auth` | Get OAuth URL |
| POST | `/api/gmail/sync` | Trigger manual sync |
