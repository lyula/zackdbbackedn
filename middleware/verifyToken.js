const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

module.exports = function verifyToken(req, res, next) {
  const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
  if (!token) {
    return res.status(401).json({ message: 'No token provided.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      email: decoded.email,
      username: decoded.username,
      userId: decoded.userId // <-- Ensure this is set
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token.' });
  }
};