const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors    = require('cors');
const patternRouter   = require('./routes/pattern');
const templatesRouter = require('./routes/templates');
const projectsRouter  = require('./routes/projects');
const { TEMPLATES }   = require('./data/templates');
const DMC_COLORS      = require('./data/dmcColors');
const mongo           = require('./lib/mongo');

const app  = express();
const PORT = process.env.PORT || 5001;

// Allow all origins so Expo mobile apps can connect from the local network
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

app.use('/api', patternRouter);
app.use('/api', templatesRouter);
app.use('/api', projectsRouter);

app.get('/health', async (_req, res) => {
  // Run a quick mongo ping so /health surfaces DB connectivity status —
  // makes it useful as a smoke test from CI / mobile.
  let mongoOk = false;
  try {
    const db = await mongo.getDb();
    const r = await db.admin().ping();
    mongoOk = r?.ok === 1;
  } catch { mongoOk = false; }
  res.json({
    status: 'ok',
    port: PORT,
    templates: TEMPLATES.length,
    dmcColors: DMC_COLORS.length,
    mongo: mongoOk,
    time: new Date().toISOString(),
  });
});

// Connect to Mongo first, then start listening — fail fast if Mongo is down
// so the dev sees a clear error instead of every request 500'ing later.
(async () => {
  try {
    await mongo.connect();
  } catch (err) {
    console.error(`❌  MongoDB connection failed: ${err.message}`);
    console.error('    Start it with:  brew services start mongodb-community');
    process.exit(1);
  }

  // Bind to 0.0.0.0 so the server is reachable from other devices on the LAN
  app.listen(PORT, '0.0.0.0', () => {
    const tplByDiff = TEMPLATES.reduce((acc, t) => {
      acc[t.difficulty] = (acc[t.difficulty] || 0) + 1;
      return acc;
    }, {});
    const tplBreakdown = ['easy', 'medium', 'hard']
      .map((d) => `${tplByDiff[d] || 0} ${d}`)
      .join(', ');

    console.log(`\n🧵  Threadia backend running on port ${PORT}`);
    console.log(`📋  Templates: ${TEMPLATES.length} loaded (${tplBreakdown})`);
    console.log(`🎨  DMC palette: ${DMC_COLORS.length} colours`);
    console.log(`🌐  Local:   http://localhost:${PORT}`);
    console.log(`📱  Mobile:  http://YOUR_LOCAL_IP:${PORT}  ← use this in mobile/config.js\n`);
  });
})();

// Clean shutdown — close mongo on SIGTERM/SIGINT so nodemon restarts don't
// leave dangling connections.
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, async () => {
    console.log(`\n${sig} — closing mongo & exiting`);
    await mongo.disconnect();
    process.exit(0);
  });
});
