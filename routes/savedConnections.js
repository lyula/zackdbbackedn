const express = require('express');
const router = express.Router();
const SavedConnection = require('../models/SavedConnection'); // filename should match your model file
const verifyToken = require('../middleware/verifyToken');

// Save a new connection string for the logged-in user
router.post('/', verifyToken, async (req, res) => {
  const { connectionString, clusterName } = req.body;
  if (!connectionString || !clusterName) {
    return res.status(400).json({ message: 'Both clusterName and connectionString are required.' });
  }
  try {
    // Prevent duplicate cluster names for this user
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
    res.json({ message: 'Connection string saved.', saved });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save connection string.' });
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

module.exports = router;