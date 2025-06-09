const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// Helper to get MongoDB client
async function getClient(connectionString) {
  const client = new MongoClient(connectionString, { useUnifiedTopology: true });
  await client.connect();
  return client;
}

// Search documents endpoint
router.get('/search', async (req, res) => {
  const {
    connectionString,
    dbName,
    collectionName,
    searchField,
    searchValue,
    page = 1,
    limit = 10
  } = req.query;

  if (!connectionString || !dbName || !collectionName || !searchField || !searchValue) {
    return res.status(400).json({ error: 'Missing required query parameters.' });
  }

  let client;
  try {
    client = await getClient(decodeURIComponent(connectionString));
    const db = client.db(decodeURIComponent(dbName));
    const collection = db.collection(decodeURIComponent(collectionName));

    // Build filter: string fields use regex, others use direct match
    let value = searchValue;
    if (!isNaN(Number(searchValue))) value = Number(searchValue);
    else if (searchValue === 'true') value = true;
    else if (searchValue === 'false') value = false;

    const filter = {};
    if (typeof value === 'string') {
      filter[searchField] = { $regex: value, $options: 'i' };
    } else {
      filter[searchField] = value;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const docs = await collection.find(filter).skip(skip).limit(parseInt(limit)).toArray();
    const total = await collection.countDocuments(filter);

    res.json({ documents: docs, total });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to search documents.' });
  } finally {
    if (client) await client.close();
  }
});

// Get all documents for a collection (for small/medium collections)
router.get('/documents-all', async (req, res) => {
  const { connectionString, dbName, collectionName } = req.query;

  if (!connectionString || !dbName || !collectionName) {
    return res.status(400).json({ error: 'Missing required query parameters.' });
  }

  let client;
  try {
    client = await getClient(decodeURIComponent(connectionString));
    const db = client.db(decodeURIComponent(dbName));
    const collection = db.collection(decodeURIComponent(collectionName));

    // Limit to 5000 documents for safety
    const docs = await collection.find({}).limit(5000).toArray();

    res.json({ documents: docs });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch all documents.' });
  } finally {
    if (client) await client.close();
  }
});

module.exports = router;