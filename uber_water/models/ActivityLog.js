const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: String, // e.g., 'register', 'login', 'order_placed', 'status_change'
  details: mongoose.Schema.Types.Mixed,
  ip: String,
  createdAt: { type: Date, default: Date.now, expires: 86400 } // TTL 24 ساعة
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);