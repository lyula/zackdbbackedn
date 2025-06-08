const express = require('express');
const router = express.Router();
const SavedConnection = require('../models/ConnectionString');
const verifyToken = require('../middleware/verifyToken');

// Save a new connection string for the logged-in user
router.post('/', verifyToken, async (req, res) => {
  let { connectionString } = req.body;
  if (!connectionString) {
    return res.status(400).json({ message: 'Connection string is required.' });
  }
  if (!req.user.userId) {
    return res.status(401).json({ message: 'User ID missing in token.' });
  }
  connectionString = connectionString.trim();
  try {
    // Check for duplicate connection string for this user
    const connExists = await SavedConnection.findOne({ userId: req.user.userId, connectionString });
    if (connExists) {
      return res.status(400).json({ message: 'You have already saved this connection string.' });
    }
    const saved = new SavedConnection({
      userId: req.user.userId,
      connectionString
    });
    await saved.save();
    return res.json({ message: 'Connection string saved.', saved });
  } catch (err) {
    console.error('Error saving connection string:', err); // Log error to server console
    return res.status(500).json({ message: 'Failed to save connection string.', error: err.message });
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

// Delete a saved connection by connectionString
router.delete('/:connectionString', verifyToken, async (req, res) => {
  try {
    const decodedConnStr = decodeURIComponent(req.params.connectionString);
    const result = await SavedConnection.deleteOne({ userId: req.user.userId, connectionString: decodedConnStr });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Connection not found.' });
    }
    res.json({ message: 'Connection deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete connection.' });
  }
});

module.exports = router;