const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, mirrors the seeded "attachments over 10MB" bug on purpose

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
});

// List attachments for a bug
router.get('/bugs/:bugId/attachments', requireAuth, (req, res) => {
  const attachments = db.prepare(`
    SELECT a.*, u.name as uploader_name FROM attachments a
    JOIN users u ON a.uploader_id = u.id
    WHERE a.bug_id = ? ORDER BY a.created_at DESC
  `).all(req.params.bugId);
  res.json(attachments);
});

// Upload a new attachment
router.post('/bugs/:bugId/attachments', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File is too large. Max size is 10MB.' });
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }

    const bug = db.prepare('SELECT * FROM bugs WHERE id = ?').get(req.params.bugId);
    if (!bug) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(404).json({ error: 'Bug not found' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const id = uuid();
    db.prepare(`
      INSERT INTO attachments (id, bug_id, uploader_id, filename, original_name, mime_type, size_bytes)
      VALUES (?,?,?,?,?,?,?)
    `).run(id, req.params.bugId, req.user.id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size);

    db.prepare("UPDATE bugs SET updated_at = datetime('now') WHERE id = ?").run(req.params.bugId);
    db.prepare('INSERT INTO activity (id, bug_id, actor_id, field, old_value, new_value) VALUES (?,?,?,?,?,?)')
      .run(uuid(), req.params.bugId, req.user.id, 'attachment', null, req.file.originalname);

    const attachment = db.prepare(`
      SELECT a.*, u.name as uploader_name FROM attachments a JOIN users u ON a.uploader_id = u.id WHERE a.id = ?
    `).get(id);
    res.status(201).json(attachment);
  });
});

// Download an attachment
router.get('/attachments/:id/download', requireAuth, (req, res) => {
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
  if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
  const filePath = path.join(UPLOAD_DIR, attachment.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File no longer exists on disk' });
  res.download(filePath, attachment.original_name);
});

// Delete an attachment (uploader or admin only)
router.delete('/attachments/:id', requireAuth, (req, res) => {
  const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(req.params.id);
  if (!attachment) return res.status(404).json({ error: 'Attachment not found' });
  if (attachment.uploader_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only the uploader or an admin can delete this attachment' });
  }
  const filePath = path.join(UPLOAD_DIR, attachment.filename);
  fs.unlink(filePath, () => {});
  db.prepare('DELETE FROM attachments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
