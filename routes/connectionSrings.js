const express = require('express');
const router = express.Router();
const ConnectionString = require('../models/ConnectionString');
const authMiddleware = require('../middleware/auth'); // JWT/auth middleware

// Get all connection strings for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.id; // set by auth middleware
  const strings = await ConnectionString.find({ userId });
  res.json(strings);
});

// Save a new connection string for the logged-in user
router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const username = req.user.username; // <-- get username from auth middleware
  const { connectionString } = req.body;
  const newString = new ConnectionString({ userId, username, connectionString }); // <-- include username
  await newString.save();
  res.status(201).json(newString);
});

module.exports = router;