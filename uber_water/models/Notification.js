const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  message: String,
  type: { type: String, enum: ['info', 'success', 'warning', 'error'] },
  read: { type: Boolean, default: false },
  data: mongoose.Schema.Types.Mixed, // أي بيانات إضافية
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Notification', notificationSchema);