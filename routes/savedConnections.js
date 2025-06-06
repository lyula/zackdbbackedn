const express = require('express');
const router = express.Router();
const SavedConnection = require('../models/SavedConnection');
const verifyToken = require('../middleware/verifyToken');

// Save a new connection string for the logged-in user
router.post('/', verifyToken, async (req, res) => {
  const { connectionString, label } = req.body;
  if (!connectionString) return res.status(400).json({ message: 'No connection string provided.' });
  try {
    const saved = new SavedConnection({
      userId: req.user.userId,
      connectionString,
      label
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