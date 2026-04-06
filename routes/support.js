const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const SupportTicket = require('../models/SupportTicket');
const { sendPushToUser } = require('./notifications');

// قائمة الأسئلة الشائعة المحددة مسبقاً (يمكن تخزينها في قاعدة بيانات أو في ملف)
const faqList = [
  { id: 'how-it-works', question: 'كيف تعمل المنصة؟', answer: 'المنصة تربط المستهلكين بموردي المياه المعتمدين. يمكنك إنشاء حساب، اختيار مورد، وتقديم طلب. يتم إشعار المورد ويقوم بتوصيل الماء.' },
  { id: 'payment', question: 'كيف يتم الدفع؟', answer: 'يمكن الدفع نقداً عند الاستلام، أو عبر بطاقة ائتمان إذا تم تفعيل الدفع الإلكتروني.' },
  { id: 'supplier-verification', question: 'كيف يتم توثيق الموردين؟', answer: 'يمكن للموردين طلب توثيق هويتهم عبر رفع صور الهوية وصورة شخصية. بعد مراجعة الأدمن، يحصلون على شارة "موثوق".' },
  { id: 'report-issue', question: 'كيف يمكن الإبلاغ عن مشكلة مع مورد؟', answer: 'بعد الطلب، يمكنك تقييم المورد والإبلاغ عنه عبر زر "إبلاغ" في صفحة الطلب.' }
];

// الحصول على قائمة الأسئلة الشائعة (للواجهة)
router.get('/faq', (req, res) => {
  res.json(faqList.map(f => ({ id: f.id, question: f.question }))); // بدون الإجابات، فقط الأسئلة
});

// إنشاء تذكرة دعم (للمستهلك أو المورد)
router.post('/', auth, async (req, res) => {
  try {
    const { questionType, faqQuestion, customQuestion } = req.body;
    let answer = null;
    let status = 'pending';

    if (questionType === 'faq') {
      // البحث عن السؤال في القائمة
      const found = faqList.find(f => f.id === faqQuestion);
      if (found) {
        answer = found.answer;
        status = 'answered'; // الإجابة جاهزة فوراً
      } else {
        return res.status(400).json({ message: 'السؤال غير موجود' });
      }
    }

    const ticket = new SupportTicket({
      user: req.user._id,
      questionType,
      faqQuestion: questionType === 'faq' ? faqQuestion : undefined,
      customQuestion: questionType === 'custom' ? customQuestion : undefined,
      answer,
      status
    });
    await ticket.save();

    // إذا كان السؤال من النوع المخصص، نرسل إشعار للأدمن (اختياري)
    if (questionType === 'custom') {
      // يمكن إرسال إشعار للأدمن عبر WebSocket أو push (لم نقم بإضافته بعد)
    }

    res.status(201).json({ message: 'تم إرسال استفسارك', ticket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// الحصول على تذاكر المستخدم
router.get('/my-tickets', auth, async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user._id }).sort('-createdAt');
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// (للأدمن) الحصول على التذاكر المعلقة
router.get('/pending', auth, role('admin'), async (req, res) => {
  try {
    const tickets = await SupportTicket.find({ status: 'pending', questionType: 'custom' }).populate('user', 'name phone');
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// (للأدمن) الرد على تذكرة
router.post('/:ticketId/answer', auth, role('admin'), async (req, res) => {
  try {
    const { answer } = req.body;
    const ticket = await SupportTicket.findById(req.params.ticketId);
    if (!ticket) return res.status(404).json({ message: 'التذكرة غير موجودة' });
    ticket.answer = answer;
    ticket.status = 'answered';
    ticket.answeredAt = new Date();
    await ticket.save();

    // إرسال إشعار للمستخدم
    await sendPushToUser(ticket.user, 'تم الرد على استفسارك', answer, '/consumer/support');

    res.json({ message: 'تم الرد' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;