const express = require('express');
const router = express.Router();
const ConnectionString = require('../models/ConnectionString');
const verifyToken = require('../middleware/verifyToken');

// POST /api/saved-connections
router.post('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId; // userId from decoded JWT
    const { connectionString } = req.body;

    if (!userId || !connectionString) {
      return res.status(400).json({ message: 'Missing user or connection string.' });
    }

    // Check if this user already has this connection string saved
    const exists = await ConnectionString.findOne({ userId, connectionString });
    if (exists) {
      return res.status(409).json({ message: 'Connection string already exists for this user.' });
    }

    const newConn = new ConnectionString({ userId, connectionString });
    await newConn.save();
    return res.status(201).json(newConn);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to save connection.' });
  }
});

module.exports = router;