import { Pool, types } from 'pg';
import fs from 'fs';
import path from 'path';

// PostgreSQL returns NUMERIC/DECIMAL as strings by default — parse them as floats
types.setTypeParser(1700, (val: string) => parseFloat(val)); // NUMERIC / DECIMAL
types.setTypeParser(20,   (val: string) => parseInt(val, 10)); // INT8 / BIGINT

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

export async function initDb(): Promise<void> {
  await runMigrations();
  console.log('Database initialized.');
}

async function runMigrations(): Promise<void> {
  // Try dist/db/migrations first, then fall back to src/db/migrations (works on Render)
  const distMigrations = path.join(__dirname, 'migrations');
  const srcMigrations = path.join(__dirname, '../../src/db/migrations');
  const migrationsDir = fs.existsSync(distMigrations) ? distMigrations : srcMigrations;
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.replace(/--[^\n]*/g, '').trim().length > 0);

    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('already exists')) continue;
        throw err;
      }
    }
  }
  console.log('Migrations applied.');
}
