const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const Promotion = require('../models/Promotion');

// إنشاء عرض جديد (للمورد)
router.post('/', auth, role('supplier'), async (req, res) => {
  try {
    const { title, description, discountType, value, minOrder, startDate, endDate } = req.body;
    const promotion = new Promotion({
      supplier: req.user._id,
      title,
      description,
      discountType,
      value,
      minOrder,
      startDate,
      endDate
    });
    await promotion.save();
    res.status(201).json({ message: 'تم إنشاء العرض', promotion });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// تعديل عرض
router.put('/:promoId', auth, role('supplier'), async (req, res) => {
  try {
    const promo = await Promotion.findOneAndUpdate(
      { _id: req.params.promoId, supplier: req.user._id },
      req.body,
      { new: true }
    );
    if (!promo) return res.status(404).json({ message: 'العرض غير موجود' });
    res.json({ message: 'تم التحديث', promo });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// حذف عرض
router.delete('/:promoId', auth, role('supplier'), async (req, res) => {
  try {
    await Promotion.findOneAndDelete({ _id: req.params.promoId, supplier: req.user._id });
    res.json({ message: 'تم الحذف' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// الحصول على عروض مورد معين (للمستهلكين)
router.get('/supplier/:supplierId', auth, async (req, res) => {
  try {
    const now = new Date();
    const promotions = await Promotion.find({
      supplier: req.params.supplierId,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now }
    });
    res.json(promotions);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;