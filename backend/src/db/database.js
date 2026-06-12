import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MEMBERS } from '../config/members.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/mtg.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    binder_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

function syncMembersFromConfig() {
  const upsert = db.prepare(`
    INSERT INTO users (name, binder_id) VALUES (?, ?)
    ON CONFLICT(name) DO UPDATE SET binder_id = excluded.binder_id
  `);
  const remove = db.prepare('DELETE FROM users WHERE name = ?');
  const configuredNames = new Set();

  for (const member of MEMBERS) {
    upsert.run(member.name, member.binderId);
    configuredNames.add(member.name);
  }

  for (const { name } of db.prepare('SELECT name FROM users').all()) {
    if (!configuredNames.has(name)) {
      remove.run(name);
    }
  }
}

syncMembersFromConfig();

export function getAllUsers() {
  return db.prepare('SELECT id, name, binder_id as binderId FROM users ORDER BY name').all();
}

export default db;
