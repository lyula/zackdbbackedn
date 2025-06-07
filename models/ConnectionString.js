const mongoose = require('mongoose');

const SavedConnectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  connectionString: { type: String, required: true },
  clusterName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Enforce uniqueness of connectionString per user
SavedConnectionSchema.index({ userId: 1, connectionString: 1 }, { unique: true });

module.exports = mongoose.model('SavedConnection', SavedConnectionSchema);