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

// Lightweight migration: add columns that were introduced after the initial
// schema, in case someone is running against a database created by an
// earlier version of this app (CREATE TABLE IF NOT EXISTS won't add new
// columns to an existing table).
function ensureColumn(table, column, definition) {
  const existing = conn.prepare(`PRAGMA table_info(${table})`).all();
  const hasColumn = existing.some((c) => c.name === column);
  if (!hasColumn) {
    conn.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('bugs', 'due_date', 'TEXT');

// GitHub PR integration columns
ensureColumn('bugs', 'github_pr_url', 'TEXT');
ensureColumn('bugs', 'github_pr_number', 'INTEGER');
ensureColumn('bugs', 'github_repo', 'TEXT');
ensureColumn('bugs', 'github_pr_title', 'TEXT');
ensureColumn('bugs', 'github_pr_state', 'TEXT');

// Bug watchers table (users who want notifications for a bug they don't own)
conn.exec(`
  CREATE TABLE IF NOT EXISTS bug_watchers (
    bug_id TEXT NOT NULL REFERENCES bugs(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (bug_id, user_id)
  )
`);

// Ensure rich list of default components exists for all products
const { v4: uuid } = require('uuid');

function ensureComponent(productName, componentName, description) {
  let product = conn.prepare('SELECT id FROM products WHERE name = ?').get(productName);
  if (!product) {
    const prodId = uuid();
    conn.prepare('INSERT INTO products (id, name, description) VALUES (?,?,?)').run(prodId, productName, `${productName} application`);
    product = { id: prodId };
  }
  const existing = conn.prepare('SELECT id FROM components WHERE product_id = ? AND name = ?').get(product.id, componentName);
  if (!existing) {
    conn.prepare('INSERT INTO components (id, product_id, name, description) VALUES (?,?,?,?)')
      .run(uuid(), product.id, componentName, description || '');
  }
}

const DEFAULT_COMPONENTS = [
  // Web App components
  { product: 'Web App', name: 'Authentication', description: 'Login, signup, sessions, OAuth' },
  { product: 'Web App', name: 'UI/UX', description: 'Frontend rendering and styling' },
  { product: 'Web App', name: 'Dashboard & Analytics', description: 'Charts, metrics, reporting' },
  { product: 'Web App', name: 'Billing & Payments', description: 'Subscriptions, checkout, invoices' },
  { product: 'Web App', name: 'Notifications', description: 'Email alerts and in-app notifications' },
  { product: 'Web App', name: 'User Settings & Profile', description: 'Account, profile, preferences' },
  { product: 'Web App', name: 'Search & Filters', description: 'Search bar, filtering, query matching' },
  { product: 'Web App', name: 'Performance & Caching', description: 'Page load time, asset delivery, caching' },

  // Mobile App components
  { product: 'Mobile App', name: 'API & Networking', description: 'Mobile backend integration, REST APIs, payloads' },
  { product: 'Mobile App', name: 'Authentication & Biometrics', description: 'Login, FaceID, TouchID, session tokens' },
  { product: 'Mobile App', name: 'iOS UI', description: 'SwiftUI, UIKit views, iOS navigation' },
  { product: 'Mobile App', name: 'Android UI', description: 'Material design, compose layout, Android views' },
  { product: 'Mobile App', name: 'Push Notifications', description: 'FCM / APNs push messaging' },
  { product: 'Mobile App', name: 'Offline Sync & Cache', description: 'Local SQLite storage, sync queue' },
  { product: 'Mobile App', name: 'Camera & Attachments', description: 'Image picker, media capture, file uploads' },
  { product: 'Mobile App', name: 'Crash Reporting & Logs', description: 'Telemetry, error logging, diagnostics' },

  // Cloud Platform components
  { product: 'Cloud Platform', name: 'REST & GraphQL API', description: 'API routes, middleware, request handling' },
  { product: 'Cloud Platform', name: 'Database & Migrations', description: 'SQL schema, indexes, query optimization' },
  { product: 'Cloud Platform', name: 'Webhooks & Integrations', description: 'GitHub webhooks, external event dispatch' },
  { product: 'Cloud Platform', name: 'File Storage Service', description: 'Attachment uploads, S3 / disk storage' },
  { product: 'Cloud Platform', name: 'Background Workers', description: 'Async queues, scheduled tasks' },
  { product: 'Cloud Platform', name: 'Security & Rate Limiting', description: 'DDoS defense, throttling, audit trails' },
];

DEFAULT_COMPONENTS.forEach((c) => ensureComponent(c.product, c.name, c.description));

// Thin wrapper so the rest of the app can keep using the same
// db.prepare(sql).all(...params) / .get(...params) / .run(...params) API
// it already uses (this matches node:sqlite's own StatementSync API 1:1,
// so no route files needed to change).
const db = {
  prepare: (sql) => conn.prepare(sql),
  exec: (sql) => conn.exec(sql),
};

module.exports = db;
