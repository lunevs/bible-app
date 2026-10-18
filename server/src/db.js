// Инициализация базы данных SQLite (встроенный модуль node:sqlite).
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new DatabaseSync(config.dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  login         TEXT    NOT NULL,
  login_key     TEXT    NOT NULL UNIQUE,      -- lower(trim(login)) для сравнения
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'user',
  plan_id       TEXT,                          -- выбранный план (null пока не выбран)
  plan_started_at TEXT,                        -- локальная дата начала участия YYYY-MM-DD
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reading_progress (
  user_id     INTEGER NOT NULL,
  plan_id     TEXT    NOT NULL,
  plan_date   TEXT    NOT NULL,
  seconds     INTEGER NOT NULL DEFAULT 0,      -- суммарное активное время
  reached_end INTEGER NOT NULL DEFAULT 0,      -- дошёл ли до конца отрывка
  read_at     INTEGER,                          -- момент засчитывания чтения (ms), иначе null
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (user_id, plan_id, plan_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  book       TEXT    NOT NULL,
  chapter    INTEGER NOT NULL,
  verse      INTEGER NOT NULL,
  text       TEXT    NOT NULL,
  visibility TEXT    NOT NULL,                  -- 'personal' | 'open'
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notes_verse ON notes (book, chapter, verse);

CREATE TABLE IF NOT EXISTS likes (
  note_id    INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (note_id, user_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_attempts (
  login_key     TEXT    PRIMARY KEY,
  fail_count    INTEGER NOT NULL DEFAULT 0,
  first_fail_at INTEGER,
  locked_until  INTEGER
);
`);

export const now = () => Date.now();
