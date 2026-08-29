const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const notifications = db.prepare(`
    SELECT n.*, b.title as bug_title FROM notifications n
    LEFT JOIN bugs b ON n.bug_id = b.id
    WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 50
  `).all(req.user.id);
  res.json(notifications);
});

router.patch('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.patch('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
