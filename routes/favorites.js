const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const Favorite = require('../models/Favorite');
const User = require('../models/User');

// إضافة مورد إلى المفضلة (للمستهلك فقط)
router.post('/add', auth, role('consumer'), async (req, res) => {
  try {
    const { supplierId } = req.body;
    const supplier = await User.findOne({ _id: supplierId, role: 'supplier', status: 'active' });
    if (!supplier) return res.status(404).json({ message: 'المورد غير موجود' });

    const favorite = new Favorite({ consumer: req.user._id, supplier: supplierId });
    await favorite.save();
    res.status(201).json({ message: 'تمت الإضافة إلى المفضلة' });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'المورد موجود بالفعل في المفضلة' });
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// إزالة من المفضلة
router.delete('/remove/:supplierId', auth, role('consumer'), async (req, res) => {
  try {
    await Favorite.findOneAndDelete({ consumer: req.user._id, supplier: req.params.supplierId });
    res.json({ message: 'تمت الإزالة من المفضلة' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

// الحصول على قائمة المفضلين
router.get('/list', auth, role('consumer'), async (req, res) => {
  try {
    const favorites = await Favorite.find({ consumer: req.user._id }).populate('supplier', 'name phone');
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
});

module.exports = router;