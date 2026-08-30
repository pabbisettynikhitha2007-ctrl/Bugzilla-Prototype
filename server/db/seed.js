const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('./index');

function upsertUser(name, email, password, role) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return existing.id;
  const id = uuid();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?,?,?,?,?)')
    .run(id, name, email, hash, role);
  return id;
}

function upsertProduct(name, description) {
  const existing = db.prepare('SELECT id FROM products WHERE name = ?').get(name);
  if (existing) return existing.id;
  const id = uuid();
  db.prepare('INSERT INTO products (id, name, description) VALUES (?,?,?)').run(id, name, description);
  return id;
}

function upsertComponent(productId, name, description) {
  const existing = db.prepare('SELECT id FROM components WHERE product_id = ? AND name = ?').get(productId, name);
  if (existing) return existing.id;
  const id = uuid();
  db.prepare('INSERT INTO components (id, product_id, name, description) VALUES (?,?,?,?)')
    .run(id, productId, name, description);
  return id;
}

const adminId = upsertUser('Ada Admin', 'admin@demo.com', 'password123', 'admin');
const maintainerId = upsertUser('Max Maintainer', 'maintainer@demo.com', 'password123', 'maintainer');
const devId = upsertUser('Dev Dana', 'dev@demo.com', 'password123', 'developer');
const reporterId = upsertUser('Riya Reporter', 'reporter@demo.com', 'password123', 'reporter');

const webProductId = upsertProduct('Web App', 'Customer-facing web application');
const mobileProductId = upsertProduct('Mobile App', 'iOS and Android client');
const cloudProductId = upsertProduct('Cloud Platform', 'Backend services, APIs, and cloud infrastructure');

const authComponentId = upsertComponent(webProductId, 'Authentication', 'Login, signup, sessions, OAuth');
const uiComponentId = upsertComponent(webProductId, 'UI/UX', 'Frontend rendering and styling');
upsertComponent(webProductId, 'Dashboard & Analytics', 'Charts, metrics, reporting');
upsertComponent(webProductId, 'Billing & Payments', 'Subscriptions, checkout, invoices');
upsertComponent(webProductId, 'Notifications', 'Email alerts and in-app notifications');
upsertComponent(webProductId, 'User Settings & Profile', 'Account, profile, preferences');
upsertComponent(webProductId, 'Search & Filters', 'Search bar, filtering, query matching');
upsertComponent(webProductId, 'Performance & Caching', 'Page load time, asset delivery, caching');

const apiComponentId = upsertComponent(mobileProductId, 'API & Networking', 'Mobile backend integration, REST APIs, payloads');
upsertComponent(mobileProductId, 'Authentication & Biometrics', 'Login, FaceID, TouchID, session tokens');
upsertComponent(mobileProductId, 'iOS UI', 'SwiftUI, UIKit views, iOS navigation');
upsertComponent(mobileProductId, 'Android UI', 'Material design, compose layout, Android views');
upsertComponent(mobileProductId, 'Push Notifications', 'FCM / APNs push messaging');
upsertComponent(mobileProductId, 'Offline Sync & Cache', 'Local SQLite storage, sync queue');
upsertComponent(mobileProductId, 'Camera & Attachments', 'Image picker, media capture, file uploads');
upsertComponent(mobileProductId, 'Crash Reporting & Logs', 'Telemetry, error logging, diagnostics');

upsertComponent(cloudProductId, 'REST & GraphQL API', 'API routes, middleware, request handling');
upsertComponent(cloudProductId, 'Database & Migrations', 'SQL schema, indexes, query optimization');
upsertComponent(cloudProductId, 'Webhooks & Integrations', 'GitHub webhooks, external event dispatch');
upsertComponent(cloudProductId, 'File Storage Service', 'Attachment uploads, S3 / disk storage');
upsertComponent(cloudProductId, 'Background Workers', 'Async queues, scheduled tasks');
upsertComponent(cloudProductId, 'Security & Rate Limiting', 'DDoS defense, throttling, audit trails');

function createBug({ title, description, product_id, component_id, status, severity, priority, reporter_id, assignee_id }) {
  const existing = db.prepare('SELECT id FROM bugs WHERE title = ?').get(title);
  if (existing) return existing.id;
  const id = uuid();
  db.prepare(`INSERT INTO bugs (id, title, description, product_id, component_id, status, severity, priority, reporter_id, assignee_id)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, title, description, product_id, component_id, status, severity, priority, reporter_id, assignee_id);
  return id;
}

const bug1 = createBug({
  title: 'Login button unresponsive on Safari',
  description: 'Clicking the login button does nothing on Safari 17. Works fine on Chrome and Firefox.',
  product_id: webProductId,
  component_id: authComponentId,
  status: 'open',
  severity: 'major',
  priority: 'p2',
  reporter_id: reporterId,
  assignee_id: devId,
});

createBug({
  title: 'Dashboard charts overflow on mobile screens',
  description: 'The analytics charts on the dashboard overflow their container on screens narrower than 380px.',
  product_id: webProductId,
  component_id: uiComponentId,
  status: 'in_progress',
  severity: 'minor',
  priority: 'p3',
  reporter_id: reporterId,
  assignee_id: devId,
});

createBug({
  title: 'API returns 500 when uploading attachments over 10MB',
  description: 'Large attachments crash the upload endpoint instead of returning a friendly file-size error.',
  product_id: mobileProductId,
  component_id: apiComponentId,
  status: 'open',
  severity: 'critical',
  priority: 'p1',
  reporter_id: reporterId,
  assignee_id: maintainerId,
});

createBug({
  title: 'Typo in password reset email subject',
  description: "Subject reads 'Reste your password' instead of 'Reset your password'.",
  product_id: webProductId,
  component_id: authComponentId,
  status: 'resolved',
  severity: 'trivial',
  priority: 'p4',
  reporter_id: reporterId,
  assignee_id: devId,
});

if (bug1) {
  const existingComment = db.prepare('SELECT id FROM comments WHERE bug_id = ?').get(bug1);
  if (!existingComment) {
    db.prepare('INSERT INTO comments (id, bug_id, author_id, body) VALUES (?,?,?,?)')
      .run(uuid(), bug1, devId, 'Reproduced locally on Safari 17.2. Looks like an event listener binding issue. Investigating.');
  }
}

console.log('Seed complete.');
console.log('Demo logins (all use password: password123):');
console.log('  admin@demo.com       (admin)');
console.log('  maintainer@demo.com  (maintainer)');
console.log('  dev@demo.com         (developer)');
console.log('  reporter@demo.com    (reporter)');
