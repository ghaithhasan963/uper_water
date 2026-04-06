const Order = require('../models/Order');
const Rating = require('../models/Rating');
const Notification = require('../models/Notification');
const { sendNotification } = require('../socket');

// @desc    الحصول على تفاصيل طلب معين
// @route   GET /api/orders/:orderId
exports.getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('consumer', 'name phone')
      .populate('supplier', 'name phone');
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });

    if (
      order.consumer._id.toString() !== req.user._id.toString() &&
      order.supplier._id.toString() !== req.user._id.toString() &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ message: 'غير مصرح' });
    }

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    إلغاء طلب (من قبل المستهلك قبل قبوله)
// @route   PUT /api/orders/:orderId/cancel
exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
    if (order.consumer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'غير مصرح' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'لا يمكن إلغاء الطلب بعد قبوله' });
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = 'ألغاه المستهلك';
    await order.save();

    // إشعار للمورد
    await sendNotification(order.supplier, {
      title: 'تم إلغاء الطلب',
      message: 'قام المستهلك بإلغاء الطلب',
      type: 'warning',
      data: { orderId: order._id }
    });

    res.json({ message: 'تم إلغاء الطلب' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    الحصول على تقييمات مورد معين
// @route   GET /api/orders/supplier/:supplierId/ratings
exports.getSupplierRatings = async (req, res) => {
  try {
    const ratings = await Rating.find({ supplier: req.params.supplierId })
      .populate('consumer', 'name')
      .sort('-createdAt');
    res.json(ratings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};