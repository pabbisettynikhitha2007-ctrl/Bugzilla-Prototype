const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'verified', 'closed', 'reopened'];
const VALID_SEVERITIES = ['blocker', 'critical', 'major', 'normal', 'minor', 'trivial'];
const VALID_PRIORITIES = ['p1', 'p2', 'p3', 'p4', 'p5'];

function notify(userId, bugId, message) {
  if (!userId) return;
  db.prepare('INSERT INTO notifications (id, user_id, bug_id, message) VALUES (?,?,?,?)')
    .run(uuid(), userId, bugId, message);
}

function logActivity(bugId, actorId, field, oldValue, newValue) {
  db.prepare('INSERT INTO activity (id, bug_id, actor_id, field, old_value, new_value) VALUES (?,?,?,?,?,?)')
    .run(uuid(), bugId, actorId, field, oldValue ?? null, newValue ?? null);
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

  res.json({ ...enrichBug(bug), comments, activity });
});

// Create bug
router.post('/', requireAuth, (req, res) => {
  const { title, description, product_id, component_id, severity, priority, assignee_id } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (severity && !VALID_SEVERITIES.includes(severity)) return res.status(400).json({ error: 'invalid severity' });
  if (priority && !VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'invalid priority' });

  const id = uuid();
  db.prepare(`
    INSERT INTO bugs (id, title, description, product_id, component_id, severity, priority, reporter_id, assignee_id, status)
    VALUES (?,?,?,?,?,?,?,?,?, 'open')
  `).run(id, title, description || '', product_id || null, component_id || null,
    severity || 'normal', priority || 'p3', req.user.id, assignee_id || null);

  logActivity(id, req.user.id, 'created', null, title);
  if (assignee_id) notify(assignee_id, id, `You were assigned a new bug: "${title}"`);

  const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(id);
  res.status(201).json(enrichBug(bug));
});

// Update bug (status, assignee, severity, priority, resolution, title/description)
router.patch('/:id', requireAuth, (req, res) => {
  const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(req.params.id);
  if (!bug) return res.status(404).json({ error: 'Bug not found' });

  const fields = ['title', 'description', 'status', 'resolution', 'severity', 'priority', 'assignee_id', 'component_id', 'product_id'];
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

  for (const field of Object.keys(updates)) {
    logActivity(req.params.id, req.user.id, field, bug[field], updates[field]);
  }

  // Notify relevant people about status changes or reassignment
  if (updates.status) {
    notify(bug.reporter_id, req.params.id, `Bug "${bug.title}" status changed to ${updates.status}`);
    if (bug.assignee_id && bug.assignee_id !== req.user.id) {
      notify(bug.assignee_id, req.params.id, `Bug "${bug.title}" status changed to ${updates.status}`);
    }
  }
  if (updates.assignee_id) {
    notify(updates.assignee_id, req.params.id, `You were assigned to bug "${bug.title}"`);
  }

  const updated = db.prepare('SELECT * FROM bugs WHERE id = ?').get(req.params.id);
  res.json(enrichBug(updated));
});

// Add a comment
router.post('/:id/comments', requireAuth, (req, res) => {
  const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(req.params.id);
  if (!bug) return res.status(404).json({ error: 'Bug not found' });
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'Comment body is required' });

  const id = uuid();
  db.prepare('INSERT INTO comments (id, bug_id, author_id, body) VALUES (?,?,?,?)')
    .run(id, req.params.id, req.user.id, body.trim());

  db.prepare("UPDATE bugs SET updated_at = datetime('now') WHERE id = ?").run(req.params.id);

  // Notify reporter + assignee (except the commenter)
  [bug.reporter_id, bug.assignee_id].forEach((uid) => {
    if (uid && uid !== req.user.id) notify(uid, req.params.id, `New comment on "${bug.title}"`);
  });

  const comment = db.prepare(`
    SELECT c.*, u.name as author_name FROM comments c JOIN users u ON c.author_id = u.id WHERE c.id = ?
  `).get(id);
  res.status(201).json(comment);
});

module.exports = router;
