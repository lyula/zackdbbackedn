const mongoose = require('mongoose');

const connectionStringSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  clusterName: { type: String, required: true },
  connectionString: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ConnectionString', connectionStringSchema);