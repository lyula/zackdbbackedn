const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

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

// Register a new user (with password hashing)
app.post('/api/register', async (req, res) => {
  const { connectionString, dbName, collectionName, email, password } = req.body;
  if (!connectionString || !dbName || !collectionName || !email || !password) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    // Check if user already exists
    const existing = await col.findOne({ email });
    if (existing) {
      await client.close();
      return res.status(409).json({ error: 'User already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user
    await col.insertOne({ email, password: hashedPassword });
    await client.close();
    return res.json({ success: true, message: 'User registered successfully.' });
  } catch (err) {
    if (client) await client.close();
    console.error('Error in /api/register:', err);
    return res.status(500).json({ error: 'Failed to register user.' });
  }
});

// Login endpoint (with password hash check)
app.post('/api/login', async (req, res) => {
  const { connectionString, dbName, collectionName, email, password } = req.body;
  if (!connectionString || !dbName || !collectionName || !email || !password) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    // Find user by email
    const user = await col.findOne({ email });
    await client.close();
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Compare password hash
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    return res.json({ success: true, message: 'Login successful.' });
  } catch (err) {
    if (client) await client.close();
    console.error('Error in /api/login:', err);
    return res.status(500).json({ error: 'Failed to login.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
