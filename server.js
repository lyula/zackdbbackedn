const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 5000;
const JWT_SECRET = '@zackdb2025'; // Replace with your secret

const allowedOrigin = 'https://zackdbfrontend.vercel.app';

const corsOptions = {
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const app = express();

// CORS must be the first middleware
app.use(cors(corsOptions));
// Explicitly handle preflight requests for all routes
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// Connect Mongoose to your MongoDB
mongoose.connect(
  process.env.MONGODB_URI ||
    'mongodb+srv://sacredlyula:YwGHXVgqCW13ywjf@zackdb.es0atkz.mongodb.net/?retryWrites=true&w=majority&appName=zackdb',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
)
.then(() => console.log('Mongoose connected!'))
.catch(err => console.error('Mongoose connection error:', err));

// JWT authentication middleware
function authenticateJWT(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid token.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// --- NEW: Get current user info (single source of truth) ---
app.get('/api/me', authenticateJWT, (req, res) => {
  res.json({
    user: {
      email: req.user.email,
      username: req.user.username,
      userId: req.user.userId // <-- Add this line
    }
  });
});

// List databases
app.post('/api/list-databases', async (req, res) => {
  const { connectionString } = req.body;
  if (!connectionString) {
    return res.status(400).json({ error: 'Missing connection string.' });
  }
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    await client.close();
    return res.json(dbs.databases.map(db => db.name));
  } catch (err) {
    if (client) await client.close();
    console.error('Error in /api/list-databases:', err);
    return res.status(500).json({ error: 'Failed to list databases.' });
  }
});

// List collections in a database
app.post('/api/list-collections', async (req, res) => {
  const { connectionString, dbName } = req.body;
  if (!connectionString || !dbName) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    await client.close();
    return res.json(collections.map(col => col.name));
  } catch (err) {
    if (client) await client.close();
    console.error('Error in /api/list-collections:', err);
    return res.status(500).json({ error: 'Failed to list collections.' });
  }
});

// Fetch documents from a collection with backend pagination
app.get('/api/documents', async (req, res) => {
  let { connectionString, dbName, collectionName, page = 1, limit = 10 } = req.query;
  try {
    connectionString = decodeURIComponent(connectionString);
    dbName = decodeURIComponent(dbName);
    collectionName = decodeURIComponent(collectionName);
    page = parseInt(page, 10) || 1;
    limit = parseInt(limit, 10) || 10;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid parameters.' });
  }
  if (!connectionString || !dbName || !collectionName) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    const total = await col.countDocuments();
    const docs = await col.find({})
      .sort({ _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    await client.close();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    return res.json({ documents: docs, total });
  } catch (err) {
    if (client) await client.close();
    console.error('Error in /api/documents:', err);
    return res.status(500).json({ error: 'Failed to fetch documents.' });
  }
});

// Register a new user (with password hashing)
app.post('/api/register', async (req, res) => {
  const { connectionString, dbName, collectionName, email, password, username } = req.body;
  if (!connectionString || !dbName || !collectionName || !email || !password || !username) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }
  if (typeof username !== 'string' || username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  }
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    // Check if user already exists
    const existing = await col.findOne({ email });
    if (existing) {
      await client.close();
      return res.status(409).json({ error: 'User already exists.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user with username
    await col.insertOne({ email, password: hashedPassword, username: username.trim() });
    await client.close();
    return res.json({ success: true, message: 'User registered successfully.' });
  } catch (err) {
    if (client) await client.close();
    console.error('Error in /api/register:', err);
    return res.status(500).json({ error: 'Failed to register user.' });
  }
});

// Login endpoint (with password hash check)
app.post('/api/login', async (req, res) => {
  const { connectionString, dbName, collectionName, email, password } = req.body;
  if (!connectionString || !dbName || !collectionName || !email || !password) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    // Find user by email
    const user = await col.findOne({ email });
    if (!user) {
      await client.close();
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Compare password hash
    const match = await bcrypt.compare(password, user.password);
    await client.close();
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Issue JWT with userId
    const token = jwt.sign(
      { 
        email: user.email, 
        username: user.username || '', 
        userId: user._id.toString() // <-- Ensure this is present
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Set JWT as httpOnly cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true, // must be true for cross-site cookies
      sameSite: 'none', // must be 'none' for cross-site cookies
      maxAge: 2 * 60 * 60 * 1000
    });
    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      user: {
        email: user.email,
        username: user.username || '',
        userId: user._id.toString() // <-- Ensure this is present
      }
    });
  } catch (err) {
    if (client) await client.close();
    console.error('Error in /api/login:', err);
    return res.status(500).json({ error: 'Failed to login.' });
  }
});

app.use('/api/saved-connections', require('./routes/savedConnections'));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
