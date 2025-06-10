const mongoose = require('mongoose');

const ConnectionStringSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  connectionString: { type: String, required: true }
}, { 
  collection: 'savedconnections',
  timestamps: true
});

module.exports = mongoose.model('ConnectionString', ConnectionStringSchema);