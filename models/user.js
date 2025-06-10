const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, { timestamps: true }); // <-- Added this option to show created at and updated at timestamps

module.exports = mongoose.model('User', userSchema);