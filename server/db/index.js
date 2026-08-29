const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'bugtracker.sqlite');
const conn = new DatabaseSync(DB_PATH);
conn.exec('PRAGMA journal_mode = WAL;');
conn.exec('PRAGMA foreign_keys = ON;');

// Initialize schema on first run
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
conn.exec(schema);

// Thin wrapper so the rest of the app can keep using the same
// db.prepare(sql).all(...params) / .get(...params) / .run(...params) API
// it already uses (this matches node:sqlite's own StatementSync API 1:1,
// so no route files needed to change).
const db = {
  prepare: (sql) => conn.prepare(sql),
  exec: (sql) => conn.exec(sql),
};

module.exports = db;
