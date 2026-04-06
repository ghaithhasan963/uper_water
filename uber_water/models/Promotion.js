const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema({
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: String,
  discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
  value: { type: Number, required: true }, // مثلاً 10% أو 5$ خصم
  minOrder: { type: Number, default: 0 }, // الحد الأدنى للطلب للاستفادة
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Promotion', promotionSchema);