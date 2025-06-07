const express = require('express');
const router = express.Router();
const SavedConnection = require('../models/ConnectionString');
const verifyToken = require('../middleware/verifyToken');

// Save a new connection string for the logged-in user
router.post('/', verifyToken, async (req, res) => {
  let { connectionString, clusterName } = req.body;
  if (!connectionString || !clusterName) {
    return res.status(400).json({ message: 'Connection string already exists, check saved connections list.' });
  }
  connectionString = connectionString.trim();
  try {
    // Check for duplicate cluster name for this user
    const nameExists = await SavedConnection.findOne({ userId: req.user.userId, clusterName });
    if (nameExists) {
      return res.status(400).json({ message: 'Connection string already exists, check saved connections list.' });
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
    // For ALL errors, always return the same message
    return res.status(400).json({ message: 'Connection string already exists, check saved connections list.' });
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