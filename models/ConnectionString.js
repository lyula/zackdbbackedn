const mongoose = require('mongoose');

const ConnectionStringSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  username: { type: String, required: true }, // <-- Add this line
  connectionString: { type: String, required: true }
}, { 
  collection: 'savedconnections',
  timestamps: true
});

module.exports = mongoose.model('ConnectionString', ConnectionStringSchema);