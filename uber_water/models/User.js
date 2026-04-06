const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, sparse: true }, // optional but unique if provided
  password: { type: String, required: true },
  role: { type: String, enum: ['supplier', 'consumer', 'admin'], default: 'consumer' },
  status: { type: String, enum: ['pending', 'active', 'rejected', 'suspended'], default: 'pending' },
  rejectionReason: String,
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);