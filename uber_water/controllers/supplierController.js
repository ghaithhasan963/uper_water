const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const User = require('../models/User');
const PendingEdit = require('../models/PendingEdit');
const { sendNotification } = require('../socket');

// @desc    الحصول على بيانات المورد (للوحة التحكم)
// @route   GET /api/supplier/profile
exports.getProfile = async (req, res) => {
  try {
    const supplier = await Supplier.findOne({ user: req.user._id })
      .populate('user', 'name phone email');
    if (!supplier) return res.status(404).json({ message: 'المورد غير موجود' });
    res.json(supplier);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    تحديث حالة المورد (جاهز/مشغول/فارغ/ذاهب للتعبئة)
// @route   PUT /api/supplier/status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const supplier = await Supplier.findOneAndUpdate(
      { user: req.user._id },
      { status },
      { new: true }
    );
    if (!supplier) return res.status(404).json({ message: 'المورد غير موجود' });
    res.json({ message: 'تم تحديث الحالة', supplier });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    طلب تعديل بيانات المورد (يحتاج موافقة الأدمن)
// @route   POST /api/supplier/edit-request
exports.requestEdit = async (req, res) => {
  try {
    const { field, newValue } = req.body;
    const supplier = await Supplier.findOne({ user: req.user._id });
    if (!supplier) return res.status(404).json({ message: 'المورد غير موجود' });

    const pendingEdit = new PendingEdit({
      user: req.user._id,
      field,
      oldValue: supplier[field],
      newValue
    });
    await pendingEdit.save();

    res.json({ message: 'تم إرسال طلب التعديل للمراجعة' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    إضافة خصم أو تعديل الحد الأدنى/الأقصى للطلب
// @route   PUT /api/supplier/settings
exports.updateSettings = async (req, res) => {
  try {
    const { minimumOrder, maximumOrder, discounts } = req.body;
    const supplier = await Supplier.findOneAndUpdate(
      { user: req.user._id },
      { minimumOrder, maximumOrder, discounts },
      { new: true }
    );
    res.json({ message: 'تم تحديث الإعدادات', supplier });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    عرض الطلبات الواردة (حسب الحالة)
// @route   GET /api/supplier/orders
exports.getOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { supplier: req.user._id };
    if (status) filter.status = status;
    const orders = await Order.find(filter)
      .populate('consumer', 'name phone')
      .sort('-createdAt');
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    الحصول على جدول المواعيد المقبولة للمورد (upcoming approved fills)
// @route   GET /api/supplier/appointments
exports.getAppointments = async (req, res) => {
  try {
    const now = new Date();
    const appointments = await Order.find({
      supplier: req.user._id,
      status: 'accepted',
      scheduledAt: { $gte: now }
    })
    .populate('consumer', 'name phone')
    .sort('scheduledAt');
    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    قبول طلب
// @route   PUT /api/supplier/orders/:orderId/accept
exports.acceptOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
    if (order.supplier.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'غير مصرح' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'الطلب لم يعد في حالة انتظار' });
    }

    order.status = 'accepted';
    order.acceptedAt = new Date();
    await order.save();

    await sendNotification(order.consumer, {
      title: 'تم قبول طلبك',
      message: 'قام المورد بقبول طلبك، سيصلك قريباً',
      type: 'success',
      data: { orderId: order._id }
    });

    res.json({ message: 'تم قبول الطلب', order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    تحديث حالة الطلب (in_progress, enroute, delivered, completed)
// @route   PUT /api/supplier/orders/:orderId/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body; // in_progress, enroute, delivered, completed
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
    if (order.supplier.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'غير مصرح' });
    }

    // التحقق من التسلسل الصحيح للحالات
    if (status === 'in_progress' && order.status !== 'accepted') {
      return res.status(400).json({ message: 'يجب قبول الطلب أولاً' });
    }
    if (status === 'enroute' && order.status !== 'in_progress' && order.status !== 'accepted') {
      return res.status(400).json({ message: 'يجب بدء التنفيذ أولاً' });
    }
    if (status === 'delivered' && order.status !== 'enroute') {
      return res.status(400).json({ message: 'يجب أن يكون الطلب في الطريق أولاً' });
    }
    if (status === 'completed' && order.status !== 'delivered') {
      return res.status(400).json({ message: 'يجب أن يكون الطلب قد تم توصيله أولاً' });
    }

    order.status = status;
    if (status === 'in_progress') order.inProgressAt = new Date();
    if (status === 'enroute') order.enrouteAt = new Date();
    if (status === 'delivered') order.deliveredAt = new Date();
    if (status === 'completed') order.completedAt = new Date();
    await order.save();

    let title = 'تحديث حالة الطلب';
    let message = 'تم تحديث حالة الطلب';
    if (status === 'in_progress') {
      title = 'قيد التنفيذ';
      message = 'المورد بدأ بالتحضير لطلبك';
    } else if (status === 'enroute') {
      title = 'المورد في الطريق';
      message = 'المورد في طريقه إليك، يرجى الاستعداد';
    } else if (status === 'delivered') {
      title = 'تم التوصيل';
      message = 'المورد وصل إلى موقعك، جاري تفريغ الصهريج';
    } else if (status === 'completed') {
      title = 'اكتمل الطلب';
      message = 'انتهى التفريغ، يرجى تقييم المورد';
    }

    await sendNotification(order.consumer, { title, message, type: 'info', data: { orderId: order._id } });

    res.json({ message: 'تم تحديث حالة الطلب', order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    رفض طلب (مع إمكانية إرسال سبب)
// @route   PUT /api/supplier/orders/:orderId/reject
exports.rejectOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
    if (order.supplier.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'غير مصرح' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'الطلب لم يعد في حالة انتظار' });
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = reason || 'رفض من المورد';
    await order.save();

    await sendNotification(order.consumer, {
      title: 'تم رفض طلبك',
      message: `للأسف، رفض المورد طلبك${reason ? ': ' + reason : ''}`,
      type: 'error',
      data: { orderId: order._id }
    });

    res.json({ message: 'تم رفض الطلب' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    الحصول على الإشعارات
// @route   GET /api/supplier/notifications
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort('-createdAt')
      .limit(50);
    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    تحديث قراءة الإشعار
// @route   PUT /api/supplier/notifications/:id/read
exports.markNotificationRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ message: 'تم التحديث' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    جلب تقييمات المورد
// @route   GET /api/supplier/ratings
exports.getMyRatings = async (req, res) => {
  try {
    const ratings = await Rating.find({ supplier: req.user._id })
      .populate('consumer', 'name')
      .populate('order');
    res.json(ratings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};