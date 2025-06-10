const express = require('express');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const router = express.Router();

router.post('/insert-document', async (req, res) => {
  const { connectionString, dbName, collectionName, document } = req.body;
  if (!connectionString || !dbName || !collectionName || !document) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    // Remove _id if present
    if (document._id) delete document._id;

    // Hash password if present
    if (document.password && typeof document.password === 'string' && document.password.length > 0) {
      document.password = await bcrypt.hash(document.password, 10);
    }

    const result = await col.insertOne(document);
    await client.close();
    return res.json({ success: true, insertedId: result.insertedId });
  } catch (err) {
    if (client) await client.close();
    console.error('Error in /api/insert-document:', err);
    return res.status(500).json({ error: 'Insert failed.' });
  }
});

module.exports = router;