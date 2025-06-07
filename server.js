const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
require('dotenv').config();
const User = require('./models/user');
const SavedConnection = require('./models/savedconnection');
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
    // databases is now an array of objects
    const user = new User({ username, email, password: hash, databases: [] });
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
  return res.json({ token }); // <-- THIS LINE IS CRITICAL
});

app.post('/api/create-database', verifyToken, async (req, res) => {
  const { dbName } = req.body;
  const user = await User.findById(req.user.userId);
  if (user.databases.includes(dbName)) return res.status(400).json({ message: 'Database already exists' });
  user.databases.push(dbName);
  await User.updateOne({ _id: user._id }, { $set: { databases: user.databases } });
  await db.createCollection(dbName);
  const userDb = db.client.db(dbName);
  await userDb.createCollection('default_collection'); // or any initial collection name
  res.json({ message: 'Database created', databases: user.databases });
});

app.get('/api/user-databases', verifyToken, async (req, res) => {
  const user = await User.findById(req.user.userId);
  res.json({ databases: user.databases || [] });
});

app.get('/api/collections/:dbName', verifyToken, async (req, res) => {
  const { dbName } = req.params;
  const user = await User.findById(req.user.userId);
  if (!user.databases.includes(dbName)) return res.status(403).json({ message: 'Unauthorized' });
  const collections = await db.listCollections({ name: dbName }).toArray();
  res.json(collections.map(c => c.name));
});

app.get('/api/data/:dbName/:collectionName', verifyToken, async (req, res) => {
  const { dbName, collectionName } = req.params;
  const user = await User.findById(req.user.userId);
  if (!user.databases.includes(dbName)) return res.status(403).json({ message: 'Unauthorized' });
  const userDb = db.client.db(dbName); // Switch to the user's database
  const collection = userDb.collection(collectionName);
  const data = await collection.find().toArray();
  res.json(data);
});

app.post('/api/databases', async (req, res) => {
  const { connectionString } = req.body;
  if (!connectionString) {
    return res.status(400).json({ error: 'Connection string required.' });
  }
  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    await client.close();
    // Always return an array of database names
    res.json(Array.isArray(dbs.databases) ? dbs.databases.map(db => db.name) : []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list databases.' });
  }
});

app.post('/api/collections', async (req, res) => {
  const { connectionString, dbName } = req.body;
  if (!connectionString || !dbName) {
    return res.status(400).json({ error: 'Connection string and dbName required.' });
  }
  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    await client.close();
    // Return only collection names
    res.json(collections.map(col => ({ name: col.name })));
  } catch (err) {
    res.status(400).json({ error: 'Failed to fetch collections.' });
  }
});

app.post('/api/documents', async (req, res) => {
  const { connectionString, dbName, collectionName } = req.body;
  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    const db = client.db(dbName);
    const docs = await db.collection(collectionName).find({}).limit(10000).toArray();
    await client.close();
    // Always return an array of documents
    res.json(Array.isArray(docs) ? docs : []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents.' });
  }
});

// Save a new connection (with clusterName)
app.post('/api/saved-connections', verifyToken, async (req, res) => {
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
    const saved = await SavedConnection.create({
      userId: req.user.userId,
      clusterName,
      connectionString
    });
    res.json({ message: 'Connection saved.', connection: saved });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save connection.' });
  }
});

// Get saved connections for the logged-in user
app.get('/api/saved-connections', verifyToken, async (req, res) => {
  try {
    const connections = await SavedConnection.find({ userId: req.user.userId }).sort({ createdAt: -1 });
    res.json(connections);
  } catch {
    res.status(500).json({ message: 'Failed to fetch connections.' });
  }
});

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
    console.error('Error connecting to MongoDB:', err); // <-- Add this line
    if (err.message && err.message.toLowerCase().includes('auth')) {
      return res.status(401).json({ error: 'Authentication failed. Please check your username and password.' });
    }
    return res.status(500).json({ error: 'Failed to list databases.' });
  }
});

app.post('/api/list-collections', async (req, res) => {
  const { connectionString, dbName } = req.body;
  try {
    const client = new MongoClient(connectionString);
    await client.connect();
    const db = client.db(dbName);
    const cols = await db.listCollections().toArray();
    await client.close();
    // Always return an array of collection names
    res.json(Array.isArray(cols) ? cols.map(col => col.name) : []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list collections.' });
  }
});

const userRoutes = require('./routes/user');
app.use('/api/user', userRoutes);

// Delete a saved connection by clusterName
app.delete('/api/saved-connections/:clusterName', verifyToken, async (req, res) => {
  try {
    await SavedConnection.deleteOne({ userId: req.user.userId, clusterName: req.params.clusterName });
    res.json({ message: 'Connection deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete connection.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports.verifyToken = verifyToken;
