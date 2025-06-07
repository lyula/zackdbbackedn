const express = require('express');
const router = express.Router();
const SavedConnection = require('../models/ConnectionString');
const verifyToken = require('../middleware/verifyToken');

// Save a new connection string for the logged-in user
router.post('/', verifyToken, async (req, res) => {
  const { connectionString, clusterName } = req.body;
  if (!connectionString || !clusterName) {
    return res.status(400).json({ message: 'Both clusterName and connectionString are required.' });
  }
  try {
    const exists = await SavedConnection.findOne({ userId: req.user.userId, clusterName });
    if (exists) {
      return res.status(400).json({ message: 'Cluster name already exists.' });
    }
    const saved = new SavedConnection({
      userId: req.user.userId,
      connectionString,
      clusterName
    });
    await saved.save();
    return res.json({ message: 'Connection string saved.', saved });
  } catch (err) {
    // Always return JSON, even on error
    return res.status(500).json({ message: 'Failed to save connection string.' });
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