const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const upload = require('../middleware/upload');
const IdentityVerification = require('../models/IdentityVerification');
const User = require('../models/User');
const { sendPushToUser } = require('./notifications');

// رفع طلب توثيق الهوية (لأي مستخدم)
router.post('/request', auth, upload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]), async (req, res) => {
  try {
    // التحقق من وجود الملفات
    if (!req.files || !req.files.idFront || !req.files.idBack || !req.files.selfie) {
      return res.status(400).json({ message: 'الرجاء رفع جميع الصور المطلوبة' });
    }

    // التحقق من عدم وجود طلب سابق معلق
    const existing = await IdentityVerification.findOne({ user: req.user._id, status: 'pending' });
    if (existing) {
      return res.status(400).json({ message: 'لديك طلب توثيق معلق بالفعل' });
    }

    const verification = new IdentityVerification({
      user: req.user._id,
      idFrontImage: '/uploads/' + req.files.idFront[0].filename,
      idBackImage: '/uploads/' + req.files.idBack[0].filename,
      selfieImage: '/uploads/' + req.files.selfie[0].filename
    });
    await verification.save();

    // إشعار للأدمن (يمكن عبر WebSocket)

    res.status(201).json({ message: 'تم إرسال طلب التوثيق' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// (للأدمن) الحصول على طلبات التوثيق المعلقة
router.get('/pending', auth, role('admin'), async (req, res) => {
  try {
    const requests = await IdentityVerification.find({ status: 'pending' }).populate('user', 'name phone role');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// (للأدمن) الموافقة أو رفض طلب توثيق
router.post('/:requestId/review', auth, role('admin'), async (req, res) => {
  try {
    const { action, reason } = req.body; // action: 'approve' or 'reject'
    const request = await IdentityVerification.findById(req.params.requestId).populate('user');
    if (!request) return res.status(404).json({ message: 'الطلب غير موجود' });

    if (action === 'approve') {
      request.status = 'verified';
      // يمكن إضافة شارة للمستخدم (مثلاً حقل verified في User)
      await User.findByIdAndUpdate(request.user._id, { verified: true });
    } else {
      request.status = 'rejected';
      request.rejectionReason = reason;
    }
    request.reviewedAt = new Date();
    request.reviewedBy = req.user._id;
    await request.save();

    // إرسال إشعار للمستخدم
    await sendPushToUser(request.user._id, 
      action === 'approve' ? 'تم توثيق حسابك' : 'لم يتم توثيق حسابك',
      action === 'approve' ? 'تهانينا! أصبح حسابك موثقاً الآن.' : `السبب: ${reason || 'غير محدد'}`,
      '/profile'
    );

    res.json({ message: `تم ${action === 'approve' ? 'قبول' : 'رفض'} الطلب` });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;