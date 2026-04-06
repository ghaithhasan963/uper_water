const mongoose = require('mongoose');

const supplierSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  tankCapacity: { type: Number, required: true }, // بالبراميل أو اللترات، سنعتبرها براميل
  plateNumber: { type: String, required: true },
  tankImage: { type: String }, // مسار الصورة
  status: { type: String, enum: ['ready', 'busy', 'empty', 'refilling'], default: 'empty' },
  minimumOrder: { type: Number, default: 1 },
  maximumOrder: { type: Number, default: 10 },
  discounts: { type: String }, // وصف الخصومات أو يمكن تخزينها بشكل منظم لاحقاً
  // مناطق الخدمة: مصفوفة تحتوي على { city, district, pricePerBarrel }
  serviceAreas: [{
    city: String,
    district: String,
    pricePerBarrel: Number
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Supplier', supplierSchema);