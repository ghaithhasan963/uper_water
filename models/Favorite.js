const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  consumer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

// التأكد من عدم تكرار المفضل
favoriteSchema.index({ consumer: 1, supplier: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);