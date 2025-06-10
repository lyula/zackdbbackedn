const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');

// POST /api/insert-document
router.post('/api/insert-document', async (req, res) => {
  const { connectionString, dbName, collectionName, document } = req.body;
  if (!connectionString || !dbName || !collectionName || !document) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  try {
    // Hash password if present
    if (document.password) {
      const saltRounds = 10;
      document.password = await bcrypt.hash(document.password, saltRounds);
    }
    // Remove fields that should not be set by user
    delete document._id;
    delete document.id;
    delete document.userId;
    delete document.createdAt;
    delete document.updatedAt;
    delete document.__v;

    const client = await MongoClient.connect(connectionString, { useUnifiedTopology: true });
    const db = client.db(dbName);
    const result = await db.collection(collectionName).insertOne(document);
    await client.close();
    res.json({ success: true, insertedId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;