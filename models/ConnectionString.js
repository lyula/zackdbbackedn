const mongoose = require('mongoose');

const connectionStringSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
  connectionString: { type: String, required: true },
  // ...other fields if needed...
});

module.exports = mongoose.model('ConnectionString', connectionStringSchema);