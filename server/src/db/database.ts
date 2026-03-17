import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '../../data/subtracker.db');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  }
  return db;
}

function runMigrations(db: Database.Database): void {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    try {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      db.exec(sql);
    } catch (e: unknown) {
      // ALTER TABLE fails if column already exists — safe to ignore
      if (!(e instanceof Error) || !e.message.includes('duplicate column')) throw e;
    }
  }
  console.log('Database migrations applied.');
}
