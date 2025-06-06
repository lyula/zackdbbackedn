const express = require('express');
const router = express.Router();
const User = require('../models/user');
const verifyToken = require('../middleware/verifyToken');

router.get('/', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    res.json({
      username: user.username,
      email: user.email
    });
  } catch (err) {
    console.error('Error in /api/user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;