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
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'bugtracker-api' }));

app.use('/api/auth', authRoutes);
app.use('/api/bugs', bugsRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api', attachmentsRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.listen(PORT, () => {
  console.log(`Bugtracker API running on http://localhost:${PORT}`);
});
