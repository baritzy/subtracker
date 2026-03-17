import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initDb(): Promise<void> {
  await runMigrations();
  console.log('Database initialized.');
}

async function runMigrations(): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations');
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
