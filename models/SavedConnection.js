const mongoose = require('mongoose');

const savedConnectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  connectionString: { type: String, required: true },
  label: { type: String }, // Optional: user-friendly name
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SavedConnection', savedConnectionSchema);