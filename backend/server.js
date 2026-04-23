const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors    = require('cors');
const patternRouter   = require('./routes/pattern');
const templatesRouter = require('./routes/templates');

const app  = express();
const PORT = process.env.PORT || 5001;

// Allow all origins so Expo mobile apps can connect from the local network
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

app.use('/api', patternRouter);
app.use('/api', templatesRouter);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', port: PORT, time: new Date().toISOString() })
);

// Bind to 0.0.0.0 so the server is reachable from other devices on the LAN
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🧵  Threadia backend running on port ${PORT}`);
  console.log(`🌐  Local:   http://localhost:${PORT}`);
  console.log(`📱  Mobile:  http://YOUR_LOCAL_IP:${PORT}  ← use this in mobile/config.js\n`);
});
