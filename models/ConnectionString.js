const mongoose = require('mongoose');

const SavedConnectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  connectionString: { type: String, required: true },
  clusterName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SavedConnection', SavedConnectionSchema);