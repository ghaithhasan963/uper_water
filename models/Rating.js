const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  consumer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // أبعاد متعددة
  punctuality: { type: Number, min: 1, max: 5 }, // الالتزام بالموعد
  waterQuality: { type: Number, min: 1, max: 5 }, // جودة الماء
  cleanliness: { type: Number, min: 1, max: 5 }, // نظافة الصهريج
  professionalism: { type: Number, min: 1, max: 5 }, // احترامية السائق
  comment: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Rating', ratingSchema);