const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

router.post('/documents', async (req, res) => {
  const { connectionString, dbName, collectionName, ...doc } = req.body;
  if (!connectionString || !dbName || !collectionName) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }
  let client;
  try {
    client = new MongoClient(connectionString, { useUnifiedTopology: true });
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    const result = await collection.insertOne(doc);
    await client.close();
    res.json({ success: true, insertedId: result.insertedId });
  } catch (err) {
    if (client) await client.close();
    res.status(500).json({ error: err.message || 'Failed to insert document.' });
  }
});

module.exports = router;