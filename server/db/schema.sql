-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'developer', -- admin | maintainer | developer | reporter
  created_at TEXT DEFAULT (datetime('now'))
);

-- Products (top-level grouping, like Bugzilla's Product)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT
);

-- Components (sub-grouping within a product)
CREATE TABLE IF NOT EXISTS components (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  description TEXT
);

-- Bugs / Issues
CREATE TABLE IF NOT EXISTS bugs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  product_id TEXT REFERENCES products(id),
  component_id TEXT REFERENCES components(id),
  status TEXT NOT NULL DEFAULT 'open',       -- open | in_progress | resolved | verified | closed | reopened
  resolution TEXT,                            -- fixed | wontfix | duplicate | invalid | worksforme (set when resolved/closed)
  severity TEXT NOT NULL DEFAULT 'normal',    -- blocker | critical | major | normal | minor | trivial
  priority TEXT NOT NULL DEFAULT 'p3',        -- p1 | p2 | p3 | p4 | p5
  reporter_id TEXT REFERENCES users(id),
  assignee_id TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Comments on a bug
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  bug_id TEXT NOT NULL REFERENCES bugs(id),
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Activity log (audit trail of field changes, like Bugzilla's bug activity)
CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  bug_id TEXT NOT NULL REFERENCES bugs(id),
  actor_id TEXT REFERENCES users(id),
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Simple in-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  bug_id TEXT REFERENCES bugs(id),
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
