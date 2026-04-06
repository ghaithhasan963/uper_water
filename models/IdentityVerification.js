const mongoose = require('mongoose');

const identityVerificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  idFrontImage: { type: String, required: true }, // مسار صورة وجه الهوية
  idBackImage: { type: String, required: true }, // مسار صورة ظهر الهوية
  selfieImage: { type: String, required: true }, // صورة شخصية مع الهوية
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
  rejectionReason: String,
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('IdentityVerification', identityVerificationSchema);