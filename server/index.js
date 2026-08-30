require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const bugsRoutes = require('./routes/bugs');
const metaRoutes = require('./routes/meta');
const notificationsRoutes = require('./routes/notifications');
const attachmentsRoutes = require('./routes/attachments');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

// Note: GitHub webhook endpoint needs raw body BEFORE express.json() middleware
// It is handled inside the bugs route with express.raw()
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'signal-bugtracker-api' }));

app.use('/api/auth', authRoutes);
app.use('/api/bugs', bugsRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api', attachmentsRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`Signal Bug Tracker API running on http://localhost:${PORT}`);
});
