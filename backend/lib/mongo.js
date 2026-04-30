const { MongoClient } = require('mongodb');

// Single shared client for the lifetime of the process. Express will share
// the connection pool — MongoClient is internally pool-managed, so we only
// instantiate it once even if multiple modules import this file.
let client = null;
let dbPromise = null;

function getMongoUrl() {
  return process.env.MONGO_URL || 'mongodb://localhost:27017/threadia';
}

function getDbNameFromUrl(url) {
  // mongodb://host:port/dbname — extract the trailing path segment, strip query
  const m = url.match(/\/([^/?]+)(?:\?|$)/);
  return m ? m[1] : 'threadia';
}

// Lazy connect — first caller pays the handshake cost, subsequent callers
// reuse the same Db handle.
async function getDb() {
  if (dbPromise) return dbPromise;
  const url = getMongoUrl();
  const dbName = getDbNameFromUrl(url);
  client = new MongoClient(url, {
    // sensible defaults for a local dev / single-instance prod
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
  });
  dbPromise = client.connect().then(() => {
    console.log(`🍃  MongoDB connected — db: ${dbName}`);
    return client.db(dbName);
  }).catch((err) => {
    dbPromise = null; // allow retry on next call
    throw err;
  });
  return dbPromise;
}

// Eagerly connect at boot so we fail fast if mongo isn't running, and so
// the first request doesn't pay the cold-start cost.
async function connect() {
  await getDb();
}

async function disconnect() {
  if (client) {
    await client.close();
    client = null;
    dbPromise = null;
  }
}

module.exports = { getDb, connect, disconnect };
