const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// List databases
app.post('/api/list-databases', async (req, res) => {
  const { connectionString } = req.body;
  if (!connectionString) {
    return res.status(400).json({ error: 'Missing connection string.' });
  }
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    await client.close();
    return res.json(dbs.databases.map(db => db.name));
  } catch (err) {
    if (client) await client.close();
    console.error('Error in /api/list-databases:', err);
    return res.status(500).json({ error: 'Failed to list databases.' });
  }
});

// List collections in a database
app.post('/api/list-collections', async (req, res) => {
  const { connectionString, dbName } = req.body;
  if (!connectionString || !dbName) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    await client.close();
    return res.json(collections.map(col => col.name));
  } catch (err) {
    if (client) await client.close();
    console.error('Error in /api/list-collections:', err);
    return res.status(500).json({ error: 'Failed to list collections.' });
  }
});

// Fetch documents from a collection with backend pagination
app.get('/api/documents', async (req, res) => {
  let { connectionString, dbName, collectionName, page = 1, limit = 10 } = req.query;
  try {
    connectionString = decodeURIComponent(connectionString);
    dbName = decodeURIComponent(dbName);
    collectionName = decodeURIComponent(collectionName);
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 10;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid parameters.' });
  }
  if (!connectionString || !dbName || !collectionName) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    const total = await col.countDocuments();
    const docs = await col.find({})
      .sort({ _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    await client.close();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    return res.json({ documents: docs, total });
  } catch (err) {
    if (client) await client.close();
    console.error('Error in /api/documents:', err);
    return res.status(500).json({ error: 'Failed to fetch documents.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
