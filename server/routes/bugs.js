const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'verified', 'closed', 'reopened'];
const VALID_SEVERITIES = ['blocker', 'critical', 'major', 'normal', 'minor', 'trivial'];
const VALID_PRIORITIES = ['p1', 'p2', 'p3', 'p4', 'p5'];

const FIELD_LABELS = {
  title: 'title',
  description: 'description',
  status: 'status',
  resolution: 'resolution',
  severity: 'severity',
  priority: 'priority',
  assignee_id: 'assignee',
  component_id: 'component',
  product_id: 'product',
  due_date: 'due date',
};

function getUserName(id) {
  if (!id) return null;
  const u = db.prepare('SELECT name FROM users WHERE id = ?').get(id);
  return u ? u.name : null;
}

function getProductName(id) {
  if (!id) return null;
  const p = db.prepare('SELECT name FROM products WHERE id = ?').get(id);
  return p ? p.name : null;
}

function getComponentName(id) {
  if (!id) return null;
  const c = db.prepare('SELECT name FROM components WHERE id = ?').get(id);
  return c ? c.name : null;
}

function resolveFieldValue(field, rawValue) {
  if (rawValue === null || rawValue === undefined) return null;
  if (field === 'assignee_id') return getUserName(rawValue) || rawValue;
  if (field === 'product_id') return getProductName(rawValue) || rawValue;
  if (field === 'component_id') return getComponentName(rawValue) || rawValue;
  if (field === 'status') return rawValue.replace('_', ' ');
  return rawValue;
}

function notify(userId, bugId, message) {
  if (!userId) return;
  db.prepare('INSERT INTO notifications (id, user_id, bug_id, message) VALUES (?,?,?,?)')
    .run(uuid(), userId, bugId, message);
}

function notifyWatchers(bugId, excludeUserId, message) {
  const watchers = db.prepare('SELECT user_id FROM bug_watchers WHERE bug_id = ?').all(bugId);
  for (const w of watchers) {
    if (w.user_id !== excludeUserId) {
      notify(w.user_id, bugId, message);
    }
  }
}

function logActivity(bugId, actorId, field, oldValue, newValue) {
  const label = FIELD_LABELS[field] || field;
  const resolvedOld = resolveFieldValue(field, oldValue);
  const resolvedNew = resolveFieldValue(field, newValue);
  db.prepare('INSERT INTO activity (id, bug_id, actor_id, field, old_value, new_value) VALUES (?,?,?,?,?,?)')
    .run(uuid(), bugId, actorId, label, resolvedOld ?? null, resolvedNew ?? null);
}

function enrichBug(bug) {
  const reporter = bug.reporter_id ? db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(bug.reporter_id) : null;
  const assignee = bug.assignee_id ? db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(bug.assignee_id) : null;
  const product = bug.product_id ? db.prepare('SELECT id, name FROM products WHERE id = ?').get(bug.product_id) : null;
  const component = bug.component_id ? db.prepare('SELECT id, name FROM components WHERE id = ?').get(bug.component_id) : null;
  return { ...bug, reporter, assignee, product, component };
}

// List + filter + search bugs
router.get('/', requireAuth, (req, res) => {
  const { status, severity, priority, product_id, assignee_id, q } = req.query;
  let sql = 'SELECT * FROM bugs WHERE 1=1';
  const params = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (severity) { sql += ' AND severity = ?'; params.push(severity); }
  if (priority) { sql += ' AND priority = ?'; params.push(priority); }
  if (product_id) { sql += ' AND product_id = ?'; params.push(product_id); }
  if (assignee_id) { sql += ' AND assignee_id = ?'; params.push(assignee_id); }
  if (q) { sql += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }

  sql += ' ORDER BY created_at DESC';
  const bugs = db.prepare(sql).all(...params).map(enrichBug);
  res.json(bugs);
});

// Dashboard / analytics summary
router.get('/stats/summary', requireAuth, (req, res) => {
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM bugs GROUP BY status').all();
  const bySeverity = db.prepare('SELECT severity, COUNT(*) as count FROM bugs GROUP BY severity').all();
  const byProduct = db.prepare(`
    SELECT p.name as product, COUNT(*) as count
    FROM bugs b LEFT JOIN products p ON b.product_id = p.id
    GROUP BY p.name
  `).all();
  const openCount = db.prepare("SELECT COUNT(*) as c FROM bugs WHERE status NOT IN ('closed','verified')").get().c;
  const totalCount = db.prepare('SELECT COUNT(*) as c FROM bugs').get().c;
  const recentlyResolved = db.prepare(`
    SELECT COUNT(*) as c FROM bugs
    WHERE status IN ('resolved','verified','closed') AND updated_at >= datetime('now', '-7 days')
  `).get().c;

  res.json({ byStatus, bySeverity, byProduct, openCount, totalCount, recentlyResolved });
});

// Duplicate detection: find similar bugs by keyword matching
router.get('/similar', requireAuth, (req, res) => {
  const { title = '', description = '' } = req.query;
  if (!title && !description) return res.json([]);

  const words = `${title} ${description}`
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (words.length === 0) return res.json([]);

  const uniqueWords = [...new Set(words)].slice(0, 8);
  const conditions = uniqueWords.map(() => '(LOWER(title) LIKE ? OR LOWER(description) LIKE ?)').join(' OR ');
  const params = uniqueWords.flatMap((w) => [`%${w}%`, `%${w}%`]);

  const bugs = db.prepare(`
    SELECT * FROM bugs WHERE (${conditions})
    ORDER BY updated_at DESC LIMIT 5
  `).all(...params).map(enrichBug);

  res.json(bugs);
});

// GitHub webhook: auto-resolve bugs when linked PR is merged
router.post('/github/webhook', express.raw({ type: '*/*' }), (req, res) => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (secret) {
    const crypto = require('crypto');
    const sig = req.headers['x-hub-signature-256'];
    const body = req.body;
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
    if (sig !== expected) return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const event = req.headers['x-github-event'];
  if (event === 'pull_request') {
    const pr = payload.pull_request;
    if (payload.action === 'closed' && pr && pr.merged) {
      const prUrl = pr.html_url;
      const linkedBugs = db.prepare(
        "SELECT * FROM bugs WHERE github_pr_url = ? AND status NOT IN ('resolved','verified','closed')"
      ).all(prUrl);
      for (const bug of linkedBugs) {
        db.prepare(
          "UPDATE bugs SET status = 'resolved', resolution = 'fixed', updated_at = datetime('now') WHERE id = ?"
        ).run(bug.id);
        db.prepare(
          'INSERT INTO activity (id, bug_id, actor_id, field, old_value, new_value) VALUES (?,?,?,?,?,?)'
        ).run(uuid(), bug.id, null, 'status', bug.status.replace('_', ' '), 'resolved');
        const msg = `Bug "${bug.title}" was automatically resolved — linked PR was merged`;
        if (bug.reporter_id) notify(bug.reporter_id, bug.id, msg);
        if (bug.assignee_id) notify(bug.assignee_id, bug.id, msg);
        notifyWatchers(bug.id, null, msg);
      }
    }
  }
  res.json({ ok: true });
});

// Get single bug with comments + activity
router.get('/:id', requireAuth, (req, res) => {
  const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(req.params.id);
  if (!bug) return res.status(404).json({ error: 'Bug not found' });

  const comments = db.prepare(`
    SELECT c.*, u.name as author_name FROM comments c
    JOIN users u ON c.author_id = u.id
    WHERE c.bug_id = ? ORDER BY c.created_at ASC
  `).all(req.params.id);

  const activity = db.prepare(`
    SELECT a.*, u.name as actor_name FROM activity a
    LEFT JOIN users u ON a.actor_id = u.id
    WHERE a.bug_id = ? ORDER BY a.created_at ASC
  `).all(req.params.id);

  const watching = !!db.prepare('SELECT 1 FROM bug_watchers WHERE bug_id = ? AND user_id = ?')
    .get(req.params.id, req.user.id);
  const watcherCount = db.prepare('SELECT COUNT(*) as c FROM bug_watchers WHERE bug_id = ?')
    .get(req.params.id).c;
  const commentCount = db.prepare('SELECT COUNT(*) as c FROM comments WHERE bug_id = ?').get(req.params.id).c;
  const attachmentCount = db.prepare('SELECT COUNT(*) as c FROM attachments WHERE bug_id = ?').get(req.params.id).c;

  res.json({ ...enrichBug(bug), comments, activity, watching, watcherCount, commentCount, attachmentCount });
});

// Create bug
router.post('/', requireAuth, (req, res) => {
  const { title, description, product_id, component_id, severity, priority, assignee_id, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (severity && !VALID_SEVERITIES.includes(severity)) return res.status(400).json({ error: 'invalid severity' });
  if (priority && !VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'invalid priority' });

  const id = uuid();
  db.prepare(`
    INSERT INTO bugs (id, title, description, product_id, component_id, severity, priority, reporter_id, assignee_id, due_date, status)
    VALUES (?,?,?,?,?,?,?,?,?,?, 'open')
  `).run(id, title, description || '', product_id || null, component_id || null,
    severity || 'normal', priority || 'p3', req.user.id, assignee_id || null, due_date || null);

  db.prepare('INSERT INTO activity (id, bug_id, actor_id, field, old_value, new_value) VALUES (?,?,?,?,?,?)')
    .run(uuid(), id, req.user.id, 'created', null, title);

  if (assignee_id) {
    const assigneeName = getUserName(assignee_id);
    if (assigneeName) {
      db.prepare('INSERT INTO activity (id, bug_id, actor_id, field, old_value, new_value) VALUES (?,?,?,?,?,?)')
        .run(uuid(), id, req.user.id, 'assignee', null, assigneeName);
    }
    notify(assignee_id, id, `You were assigned a new bug: "${title}"`);
  }

  const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(id);
  res.status(201).json(enrichBug(bug));
});

// Update bug
router.patch('/:id', requireAuth, (req, res) => {
  const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(req.params.id);
  if (!bug) return res.status(404).json({ error: 'Bug not found' });

  const fields = [
    'title', 'description', 'status', 'resolution', 'severity', 'priority',
    'assignee_id', 'component_id', 'product_id', 'due_date',
    'github_pr_url', 'github_pr_number', 'github_repo', 'github_pr_title', 'github_pr_state',
  ];
  const updates = {};

  for (const field of fields) {
    if (req.body[field] !== undefined && req.body[field] !== bug[field]) {
      if (field === 'status' && !VALID_STATUSES.includes(req.body.status)) {
        return res.status(400).json({ error: 'invalid status' });
      }
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.json(enrichBug(bug));
  }

  const setClause = Object.keys(updates).map((f) => `${f} = ?`).join(', ');
  const values = Object.values(updates);
  db.prepare(`UPDATE bugs SET ${setClause}, updated_at = datetime('now') WHERE id = ?`).run(...values, req.params.id);

  const prFields = new Set(['github_pr_url', 'github_pr_number', 'github_repo', 'github_pr_title', 'github_pr_state']);
  for (const field of Object.keys(updates)) {
    if (prFields.has(field)) continue;
    logActivity(req.params.id, req.user.id, field, bug[field], updates[field]);
  }

  if (updates.github_pr_url) {
    db.prepare('INSERT INTO activity (id, bug_id, actor_id, field, old_value, new_value) VALUES (?,?,?,?,?,?)')
      .run(uuid(), req.params.id, req.user.id, 'github pr', bug.github_pr_url || null, updates.github_pr_url);
  }

  if (updates.status) {
    const statusLabel = updates.status.replace('_', ' ');
    const msg = `Bug "${bug.title}" status changed to ${statusLabel}`;
    if (bug.reporter_id !== req.user.id) notify(bug.reporter_id, req.params.id, msg);
    if (bug.assignee_id && bug.assignee_id !== req.user.id) notify(bug.assignee_id, req.params.id, msg);
    notifyWatchers(req.params.id, req.user.id, msg);
  }
  if (updates.assignee_id) {
    notify(updates.assignee_id, req.params.id, `You were assigned to bug "${bug.title}"`);
    notifyWatchers(req.params.id, req.user.id, `Bug "${bug.title}" was reassigned`);
  }
  if (updates.priority || updates.severity) {
    notifyWatchers(req.params.id, req.user.id, `Bug "${bug.title}" was updated`);
  }

  const updated = db.prepare('SELECT * FROM bugs WHERE id = ?').get(req.params.id);
  res.json(enrichBug(updated));
});

// Add a comment (with @mention support)
router.post('/:id/comments', requireAuth, (req, res) => {
  const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(req.params.id);
  if (!bug) return res.status(404).json({ error: 'Bug not found' });
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'Comment body is required' });

  const id = uuid();
  db.prepare('INSERT INTO comments (id, bug_id, author_id, body) VALUES (?,?,?,?)')
    .run(id, req.params.id, req.user.id, body.trim());

  db.prepare("UPDATE bugs SET updated_at = datetime('now') WHERE id = ?").run(req.params.id);

  db.prepare('INSERT INTO activity (id, bug_id, actor_id, field, old_value, new_value) VALUES (?,?,?,?,?,?)')
    .run(uuid(), req.params.id, req.user.id, 'comment', null, body.trim().slice(0, 120));

  // Handle @mentions
  const allUsers = db.prepare('SELECT id, name FROM users').all();
  const mentionedUserIds = new Set();
  const mentionRegex = /@([\w][\w ]{0,30}?)(?=\s|$|[,!?.;])/g;
  let match;
  while ((match = mentionRegex.exec(body)) !== null) {
    const mentioned = match[1].trim().toLowerCase();
    const foundUser = allUsers.find((u) => u.name.toLowerCase() === mentioned);
    if (foundUser && foundUser.id !== req.user.id && !mentionedUserIds.has(foundUser.id)) {
      mentionedUserIds.add(foundUser.id);
      notify(foundUser.id, req.params.id, `${req.user.name} mentioned you in a comment on "${bug.title}"`);
    }
  }

  [bug.reporter_id, bug.assignee_id].forEach((uid) => {
    if (uid && uid !== req.user.id && !mentionedUserIds.has(uid)) {
      notify(uid, req.params.id, `New comment on "${bug.title}"`);
    }
  });

  const notifiedAlready = new Set([req.user.id, ...mentionedUserIds, bug.reporter_id, bug.assignee_id].filter(Boolean));
  const watchers = db.prepare('SELECT user_id FROM bug_watchers WHERE bug_id = ?').all(req.params.id);
  for (const w of watchers) {
    if (!notifiedAlready.has(w.user_id)) {
      notify(w.user_id, req.params.id, `New comment on "${bug.title}"`);
    }
  }

  const comment = db.prepare(`
    SELECT c.*, u.name as author_name FROM comments c JOIN users u ON c.author_id = u.id WHERE c.id = ?
  `).get(id);
  res.status(201).json(comment);
});

// Watch a bug
router.post('/:id/watch', requireAuth, (req, res) => {
  const bug = db.prepare('SELECT id FROM bugs WHERE id = ?').get(req.params.id);
  if (!bug) return res.status(404).json({ error: 'Bug not found' });
  const existing = db.prepare('SELECT 1 FROM bug_watchers WHERE bug_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) {
    db.prepare('INSERT INTO bug_watchers (bug_id, user_id) VALUES (?,?)').run(req.params.id, req.user.id);
  }
  res.json({ watching: true });
});

// Unwatch a bug
router.delete('/:id/watch', requireAuth, (req, res) => {
  db.prepare('DELETE FROM bug_watchers WHERE bug_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ watching: false });
});

module.exports = router;
