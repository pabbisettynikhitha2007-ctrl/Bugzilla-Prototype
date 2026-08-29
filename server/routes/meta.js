const express = require('express');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// List all users (for assignee dropdowns)
router.get('/users', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id, name, email, role FROM users ORDER BY name').all();
  res.json(users);
});

// Products + their components
router.get('/products', requireAuth, (req, res) => {
  const products = db.prepare('SELECT * FROM products ORDER BY name').all();
  const components = db.prepare('SELECT * FROM components ORDER BY name').all();
  const withComponents = products.map((p) => ({
    ...p,
    components: components.filter((c) => c.product_id === p.id),
  }));
  res.json(withComponents);
});

router.post('/products', requireAuth, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const id = uuid();
  db.prepare('INSERT INTO products (id, name, description) VALUES (?,?,?)').run(id, name, description || '');
  res.status(201).json({ id, name, description });
});

router.post('/components', requireAuth, (req, res) => {
  const { product_id, name, description } = req.body;
  if (!product_id || !name) return res.status(400).json({ error: 'product_id and name are required' });
  const id = uuid();
  db.prepare('INSERT INTO components (id, product_id, name, description) VALUES (?,?,?,?)')
    .run(id, product_id, name, description || '');
  res.status(201).json({ id, product_id, name, description });
});

module.exports = router;
