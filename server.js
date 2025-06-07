const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
require('dotenv').config();
const User = require('./models/user');
const SavedConnection = require('./models/ConnectionString');
const mongoose = require('mongoose');
const verifyToken = require('./middleware/verifyToken');

const app = express();
app.use(cors());
app.use(express.json());

// Mongoose connection for all user operations
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('Database connection error:', err));

// Native MongoDB driver ONLY for dashboard/database/collection/document operations
const uri = process.env.MONGODB_URI;
let db;
async function connectDB() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    db = client.db('zackdb');
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.error('Database connection error:', err);
  }
}
connectDB();

// --- ALL ROUTES BELOW, OUTSIDE connectDB() ---
// User registration and login use ONLY Mongoose User model

// Register
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already in use.' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hash });
    await user.save();
    return res.status(200).json({ message: 'Registration successful.' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const token = jwt.sign(
    { userId: user._id, username: user.username, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
  return res.json({ token });
});

// List databases for a given connection string
app.post('/api/list-databases', async (req, res) => {
  const { connectionString } = req.body;
  console.log('Received connection string:', connectionString);
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    await client.close();
    return res.json(Array.isArray(dbs.databases) ? dbs.databases.map(db => db.name) : []);
  } catch (err) {
    if (client) await client.close();
    console.error('Error connecting to MongoDB:', err);
    if (err.message && err.message.toLowerCase().includes('auth')) {
      return res.status(401).json({ error: 'Authentication failed. Please check your username and password.' });
    }
    return res.status(500).json({ error: 'Failed to list databases.' });
  }
});

// List collections for a given database
app.post('/api/list-collections', async (req, res) => {
  const { connectionString, dbName } = req.body;
  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    const db = client.db(dbName);
    const cols = await db.listCollections().toArray();
    await client.close();
    res.json(Array.isArray(cols) ? cols.map(col => col.name) : []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list collections.' });
  }
});

// Fetch documents for a collection (with pagination and latest first)
app.post('/api/documents', async (req, res) => {
  const { connectionString, dbName, collectionName, page = 1, pageSize = 10 } = req.body;
  if (!connectionString || !dbName || !collectionName) {
    return res.status(400).json({ error: 'Missing parameters.' });
  }
  let client;
  try {
    client = new MongoClient(connectionString, { serverApi: { version: '1' } });
    await client.connect();
    const db = client.db(dbName);
    const col = db.collection(collectionName);

    const skip = (Number(page) - 1) * Number(pageSize);
    // Sort by _id descending to get latest first
    const docs = await col.find({})
      .sort({ _id: -1 })
      .skip(skip)
      .limit(Number(pageSize))
      .toArray();
    const total = await col.countDocuments();

    await client.close();
    return res.json({ documents: docs, total });
  } catch (err) {
    if (client) await client.close();
    return res.status(500).json({ error: 'Failed to fetch documents.' });
  }
});

// User routes
const userRoutes = require('./routes/user');
app.use('/api/user', userRoutes);

// Saved connections routes (all logic in the router)
const savedConnectionsRoutes = require('./routes/savedConnections');
app.use('/api/saved-connections', savedConnectionsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports.verifyToken = verifyToken;
