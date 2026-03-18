import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { pool } from '../db/database';

const JWT_SECRET = process.env.JWT_SECRET ?? 'subtracker-dev-secret-change-in-production';
const JWT_EXPIRES_IN = '365d';

export interface AuthUser {
  id: number;
  google_id: string;
  email: string;
  name: string | null;
  is_premium: boolean;
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3001/api/auth/callback'
  );
}

export function getAuthUrl(mode: 'popup' | 'redirect' = 'popup'): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: ['openid', 'profile', 'email'],
    prompt: 'consent',
    state: mode,
  });
}

export async function handleAuthCallback(code: string): Promise<string> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Get user profile from Google
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();

  const googleId = data.id!;
  const email = data.email ?? '';
  const name = data.name ?? null;

  // Upsert user
  const { rows } = await pool.query<{ id: number; is_premium: number }>(
    `INSERT INTO users (google_id, email, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (google_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name
     RETURNING id, is_premium`,
    [googleId, email, name]
  );
  const user = rows[0];

  // Issue JWT
  const token = jwt.sign(
    { userId: user.id, googleId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return token;
}

export async function createAnonymousUser(): Promise<string> {
  const anonId = `anon_${randomUUID()}`;
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO users (google_id, email, name) VALUES ($1, $2, $3) RETURNING id`,
    [anonId, `${anonId}@anon.local`, 'משתמש אורח']
  );
  const userId = rows[0].id;
  return jwt.sign({ userId, googleId: anonId, email: '' }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { userId: number; email: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
    return payload;
  } catch {
    return null;
  }
}

export async function getUserById(id: number): Promise<AuthUser | null> {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  if (!rows[0]) return null;
  return { ...rows[0], is_premium: rows[0].is_premium === 1 };
}
