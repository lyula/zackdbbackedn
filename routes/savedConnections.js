const express = require('express');
const router = express.Router();
const ConnectionString = require('../models/ConnectionString');
const mongoose = require('mongoose');

// GET /api/saved-connections - Get all saved connections for the logged-in user
router.get('/', require('../middleware/verifyToken'), async (req, res) => {
  try {
    // Convert userId from JWT to ObjectId
    let userId;
    try {
      userId = new mongoose.Types.ObjectId(req.user.userId);
    } catch (e) {
      return res.status(400).json({ message: 'Invalid user ID.' });
    }

    const connections = await ConnectionString.find({ userId });
    return res.status(200).json(connections);
  } catch (err) {
    console.error('Error fetching saved connections:', err);
    return res.status(500).json({ message: 'Failed to fetch saved connections.' });
  }
});

// POST /api/saved-connections
router.post('/', require('../middleware/verifyToken'), async (req, res) => {
  try {
    const { connectionString } = req.body;
    if (!connectionString) {
      return res.status(400).json({ message: 'Missing connection string.' });
    }
    // FIX: Use 'new' when creating ObjectId
    let userId;
    try {
      userId = new mongoose.Types.ObjectId(req.user.userId);
    } catch (e) {
      return res.status(400).json({ message: 'Invalid user ID.' });
    }

    const exists = await ConnectionString.findOne({ userId, connectionString });
    if (exists) {
      return res.status(409).json({ message: 'Connection string already exists for this user.' });
    }

    const newConn = new ConnectionString({ userId, connectionString });
    await newConn.save();
    return res.status(201).json(newConn);
  } catch (err) {
    console.error('Error in /api/saved-connections:', err);
    return res.status(500).json({ message: 'Failed to save connection.' });
  }
});

module.exports = router;