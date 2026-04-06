const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  consumer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quantity: { type: Number, required: true },
  pricePerBarrel: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in_progress', 'enroute', 'delivered', 'completed', 'cancelled', 'auto-cancelled'],
    default: 'pending'
  },
  consumerAddress: { type: String },
  consumerLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number]
  },
  consumerCity: String,
  consumerDistrict: String,
  consumerName: String,
  consumerPhone: String,
  createdAt: { type: Date, default: Date.now },
  acceptedAt: Date,
  enrouteAt: Date,
  deliveredAt: Date,
  inProgressAt: Date,
  completedAt: Date,
  cancelledAt: Date,
  cancelReason: String,
  // جدول المواعيد والدفع الزمني
  deliveryOption: {
    type: String,
    enum: ['now', 'today', 'tomorrow', 'scheduled'],
    default: 'now'
  },
  scheduledAt: Date,
  // تقييم المستهلك للمورد (يضاف بعد التسليم)
  rating: {
    punctuality: Number,
    waterQuality: Number,
    cleanliness: Number,
    professionalism: Number,
    comment: String,
    createdAt: Date
  }
});

module.exports = mongoose.model('Order', orderSchema);