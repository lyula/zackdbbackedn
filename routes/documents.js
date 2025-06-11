const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb'); // <-- Add ObjectId here

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

// Get a single document by ID
router.get('/document', async (req, res) => {
  const { connectionString, dbName, collectionName, id } = req.query;
  if (!connectionString || !dbName || !collectionName || !id) {
    return res.status(400).json({ error: 'Missing required query parameters.' });
  }
  let client;
  try {
    client = await getClient(decodeURIComponent(connectionString));
    const db = client.db(decodeURIComponent(dbName));
    const collection = db.collection(decodeURIComponent(collectionName));
    const doc = await collection.findOne({ _id: new require('mongodb').ObjectId(id) });
    if (!doc) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch document.' });
  } finally {
    if (client) await client.close();
  }
});

// Update a document by ID
router.put('/document', async (req, res) => {
  const { connectionString, dbName, collectionName, id } = req.query;
  const update = req.body;
  if (!connectionString || !dbName || !collectionName || !id) {
    return res.status(400).json({ error: 'Missing required query parameters.' });
  }
  let client;
  try {
    client = await getClient(decodeURIComponent(connectionString));
    const db = client.db(decodeURIComponent(dbName));
    const collection = db.collection(decodeURIComponent(collectionName));
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: update }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update document.' });
  } finally {
    if (client) await client.close();
  }
});

// Delete a document by ID
router.delete('/document', async (req, res) => {
  const { connectionString, dbName, collectionName, id } = req.query;
  if (!connectionString || !dbName || !collectionName || !id) {
    return res.status(400).json({ error: 'Missing required query parameters.' });
  }
  let client;
  try {
    client = await getClient(decodeURIComponent(connectionString));
    const db = client.db(decodeURIComponent(dbName));
    const collection = db.collection(decodeURIComponent(collectionName));
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete document.' });
  } finally {
    if (client) await client.close();
  }
});

router.post('/documents', async (req, res) => {
  const { connectionString, dbName, collectionName, document } = req.body;

  if (!connectionString || !dbName || !collectionName || !document || typeof document !== 'object') {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  let client;
  try {
    client = await MongoClient.connect(connectionString, { useNewUrlParser: true, useUnifiedTopology: true });
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Remove sensitive fields if present (defensive)
    delete document._id;
    delete document.password;
    delete document.hash;
    delete document.createdAt;
    delete document.updatedAt;
    delete document.__v;

    const result = await collection.insertOne(document);
    res.json({ insertedId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to insert document' });
  } finally {
    if (client) await client.close();
  }
});

module.exports = router;