const express = require('express');
const router = express.Router();
const SavedConnection = require('../models/ConnectionString');
const verifyToken = require('../middleware/verifyToken');

// Save a new connection string for the logged-in user
router.post('/', verifyToken, async (req, res) => {
  let { connectionString, clusterName } = req.body;
  if (!connectionString || !clusterName) {
    return res.status(400).json({ message: 'Both clusterName and connectionString are required.' });
  }
  connectionString = connectionString.trim();
  try {
    // Check for duplicate cluster name for this user
    const nameExists = await SavedConnection.findOne({ userId: req.user.userId, clusterName });
    if (nameExists) {
      return res.status(400).json({ message: 'Cluster name already exists.' });
    }
    // Let MongoDB handle duplicate connection strings via unique index
    const saved = new SavedConnection({
      userId: req.user.userId,
      connectionString,
      clusterName
    });
    await saved.save();
    return res.json({ message: 'Connection string saved.', saved });
  } catch (err) {
    console.error('Error saving connection:', err);

    // Duplicate key error (Mongo/Mongoose)
    if (err.code === 11000 || (err.message && err.message.includes('duplicate key'))) {
      return res.status(400).json({ message: 'Connection string already exists in your saved connections.' });
    }

    // Validation or other errors
    if (err.errors) {
      // Mongoose validation errors
      const messages = Object.values(err.errors).map(e => e.message).join(' ');
      return res.status(400).json({ message: messages });
    }

    // Fallback for any other error
    return res.status(500).json({ message: err.message || 'Failed to save connection string.' });
  }
});

// Get all saved connection strings for the logged-in user
router.get('/', verifyToken, async (req, res) => {
  try {
    const connections = await SavedConnection.find({ userId: req.user.userId });
    res.json(connections);
  } catch {
    res.status(500).json({ message: 'Failed to fetch connections.' });
  }
});

// Delete a saved connection by clusterName
router.delete('/:clusterName', verifyToken, async (req, res) => {
  try {
    await SavedConnection.deleteOne({ userId: req.user.userId, clusterName: req.params.clusterName });
    res.json({ message: 'Connection deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete connection.' });
  }
});

module.exports = router;