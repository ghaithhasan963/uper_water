const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questionType: { type: String, enum: ['faq', 'custom'] }, // نوع السؤال: من الأسئلة الشائعة أو استفسار مخصص
  faqQuestion: String, // السؤال المحدد من القائمة (إذا كان من النوع faq)
  customQuestion: String, // النص الذي كتبه المستخدم (إذا كان custom)
  answer: String, // إجابة الأدمن
  status: { type: String, enum: ['pending', 'answered'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  answeredAt: Date
});

module.exports = mongoose.model('SupportTicket', supportTicketSchema);