const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'arena.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    email TEXT,
    username TEXT,
    wins INTEGER DEFAULT 0,
    battles INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(provider, provider_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    checked_in_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, day)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS queue (
    user_id INTEGER PRIMARY KEY,
    ready_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL DEFAULT 'scheduled',
    scheduled_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS match_players (
    match_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    slot INTEGER NOT NULL,
    confirmed INTEGER DEFAULT 0,
    PRIMARY KEY(match_id, user_id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    round TEXT NOT NULL,
    p1 INTEGER,
    p2 INTEGER,
    winner INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    kind TEXT DEFAULT 'info',
    seen INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
});

// Small promise helpers so server code reads cleanly
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

module.exports = { db, run, get, all };
