const express = require('express');
const { MongoClient } = require('mongodb');
const router = express.Router();

// GET all saved connections for a user
router.get('/', async (req, res) => {
  const { connectionString, dbName, collectionName, userId } = req.query;
  if (!connectionString || !dbName || !collectionName || !userId) {
    // Return empty array if parameters are missing, not an error
    return res.json([]);
  }
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    const connections = await col.find({ userId }).toArray();
    await client.close();
    // Always return an array
    return res.json(Array.isArray(connections) ? connections : []);
  } catch (err) {
    if (client) await client.close();
    console.error('Error in /api/saved-connections:', err);
    // On error, return empty array (or you can return an error if you want to show a real error)
    return res.json([]);
  }
});

// POST to save a new connection
router.post('/', async (req, res) => {
  const { connectionString, dbName, collectionName, userId, name, uri } = req.body;
  if (!connectionString || !dbName || !collectionName || !userId || !name || !uri) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    // Insert new saved connection
    await col.insertOne({ userId, name, uri, createdAt: new Date() });
    await client.close();
    return res.json({ success: true, message: 'Connection saved.' });
  } catch (err) {
    if (client) await client.close();
    console.error('Error in POST /api/saved-connections:', err);
    return res.status(500).json({ error: 'Failed to save connection.' });
  }
});

module.exports = router;