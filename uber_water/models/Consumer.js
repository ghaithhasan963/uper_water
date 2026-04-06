const mongoose = require('mongoose');

const consumerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  address: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true } // [longitude, latitude]
  },
  city: String,
  district: String,
  createdAt: { type: Date, default: Date.now }
});

consumerSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Consumer', consumerSchema);