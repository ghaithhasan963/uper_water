const Consumer = require('../models/Consumer');
const Supplier = require('../models/Supplier');
const Order = require('../models/Order');
const Rating = require('../models/Rating');
const Report = require('../models/Report');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendNotification } = require('../socket');

// @desc    طلب تعديل بيانات المستهلك (يحتاج موافقة الأدمن)
// @route   POST /api/consumer/edit-request
exports.requestEdit = async (req, res) => {
  try {
    const { field, newValue } = req.body;
    const consumer = await Consumer.findOne({ user: req.user._id }).populate('user');
    if (!consumer) return res.status(404).json({ message: 'المستهلك غير موجود' });

    // determine old value depending on prefix
    let old;
    if (field.startsWith('consumer.')) {
      const f = field.replace('consumer.', '');
      old = consumer[f];
    } else if (field.startsWith('user.')) {
      const f = field.replace('user.', '');
      old = consumer.user ? consumer.user[f] : undefined;
    } else {
      // default to user field
      old = consumer.user ? consumer.user[field] : consumer[field];
    }

    const PendingEdit = require('../models/PendingEdit');
    const pendingEdit = new PendingEdit({
      user: req.user._id,
      field,
      oldValue: old,
      newValue
    });
    await pendingEdit.save();

    res.json({ message: 'تم إرسال طلب التعديل للمراجعة' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    الحصول على بيانات المستهلك
exports.getProfile = async (req, res) => {
  try {
    const consumer = await Consumer.findOne({ user: req.user._id })
      .populate('user', 'name phone email');
    if (!consumer) return res.status(404).json({ message: 'المستهلك غير موجود' });
    res.json(consumer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    تحديث الموقع والعنوان
exports.updateLocation = async (req, res) => {
  try {
    const { address, location, city, district } = req.body;
    const consumer = await Consumer.findOneAndUpdate(
      { user: req.user._id },
      { address, location: { type: 'Point', coordinates: location }, city, district },
      { new: true }
    );
    res.json({ message: 'تم تحديث الموقع', consumer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    الحصول على الموردين المتاحين (مع فلترة) - مع إضافة صورة الصهريج ورقم اللوحة
exports.filterSuppliers = async (req, res) => {
  try {
    const { city, district, minRating, sortBy, minPrice, maxPrice } = req.body;
    const cleanCity = city.trim();
    const cleanDistrict = district.trim();

    const suppliers = await Supplier.find({
      status: 'ready',
      'serviceAreas': {
        $elemMatch: {
          city: { $regex: new RegExp(`^${cleanCity}$`, 'i') },
          district: { $regex: new RegExp(`^${cleanDistrict}$`, 'i') }
        }
      }
    }).populate({
      path: 'user',
      match: { status: 'active' },
      select: 'name phone email'
    });

    const activeSuppliers = suppliers.filter(s => s.user !== null);

    const suppliersWithRating = await Promise.all(
      activeSuppliers.map(async (supplier) => {
        const ratings = await Rating.find({ supplier: supplier.user._id });
        let avgRating = 0;
        if (ratings.length > 0) {
          const total = ratings.reduce((acc, r) => acc + 
            (r.punctuality + r.waterQuality + r.cleanliness + r.professionalism) / 4, 0);
          avgRating = total / ratings.length;
        }
        const supplierObj = supplier.toObject();
        supplierObj.avgRating = avgRating;
        supplierObj.ratingCount = ratings.length;

        const area = supplier.serviceAreas.find(
          a => a.city.toLowerCase() === cleanCity.toLowerCase() && 
               a.district.toLowerCase() === cleanDistrict.toLowerCase()
        );
        supplierObj.pricePerBarrel = area ? area.pricePerBarrel : null;

        // إضافة صورة الصهريج ورقم اللوحة
        supplierObj.tankImage = supplier.tankImage || null;
        supplierObj.plateNumber = supplier.plateNumber;

        return supplierObj;
      })
    );

    let filtered = suppliersWithRating;
    if (minRating) filtered = filtered.filter(s => s.avgRating >= minRating);
    if (minPrice && minPrice !== '') filtered = filtered.filter(s => s.pricePerBarrel >= parseFloat(minPrice));
    if (maxPrice && maxPrice !== '') filtered = filtered.filter(s => s.pricePerBarrel <= parseFloat(maxPrice));

    if (sortBy === 'rating_desc') filtered.sort((a, b) => b.avgRating - a.avgRating);
    else if (sortBy === 'price_asc') filtered.sort((a, b) => a.pricePerBarrel - b.pricePerBarrel);
    else if (sortBy === 'price_desc') filtered.sort((a, b) => b.pricePerBarrel - a.pricePerBarrel);

    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    إنشاء طلب جديد (مع حفظ بيانات المستهلك في الطلب)
exports.createOrder = async (req, res) => {
  try {
    const { supplierId, quantity } = req.body;

    const supplier = await Supplier.findOne({ user: supplierId }).populate('user');
    if (!supplier) return res.status(404).json({ message: 'المورد غير موجود' });
    if (supplier.status !== 'ready') {
      return res.status(400).json({ message: 'المورد غير متاح حالياً' });
    }
    if (supplier.user.status !== 'active') {
      return res.status(400).json({ message: 'حساب المورد غير نشط' });
    }
    if (quantity < supplier.minimumOrder || quantity > supplier.maximumOrder) {
      return res.status(400).json({ message: `الكمية يجب أن تكون بين ${supplier.minimumOrder} و ${supplier.maximumOrder}` });
    }

    const consumer = await Consumer.findOne({ user: req.user._id });
    if (!consumer) return res.status(404).json({ message: 'بيانات المستهلك غير مكتملة' });

    const area = supplier.serviceAreas.find(
      a => a.city.toLowerCase() === consumer.city.toLowerCase() && 
           a.district.toLowerCase() === consumer.district.toLowerCase()
    );
    if (!area) {
      return res.status(400).json({ message: 'هذا المورد لا يخدم منطقتك' });
    }
    const pricePerBarrel = area.pricePerBarrel;
    const totalPrice = quantity * pricePerBarrel;

    // دعم خيارات التوصيل (now, today, tomorrow, scheduled)
    const { deliveryOption, scheduledAt } = req.body;

    // إنشاء الطلب مع بيانات المستهلك كاملة
    const orderData = {
      consumer: req.user._id,
      supplier: supplierId,
      quantity,
      pricePerBarrel,
      totalPrice,
      consumerAddress: consumer.address,
      consumerLocation: consumer.location,
      consumerCity: consumer.city,
      consumerDistrict: consumer.district,
      consumerName: req.user.name,
      consumerPhone: req.user.phone,
      deliveryOption: deliveryOption || 'now'
    };

    // إذا كان المستخدم حدد موعداً مجدولاً، حاول تحويله إلى تاريخ
    if (deliveryOption === 'scheduled' && scheduledAt) {
      const dt = new Date(scheduledAt);
      if (!isNaN(dt.getTime())) {
        orderData.scheduledAt = dt;
      }
    } else if (deliveryOption === 'tomorrow') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9,0,0,0); // افتراضي الساعة 9 صباحاً
      orderData.scheduledAt = tomorrow;
    } else if (deliveryOption === 'today') {
      const today = new Date();
      today.setHours(18,0,0,0); // افتراضي الساعة 18:00 إذا لم يحدد
      orderData.scheduledAt = today;
    }

    const order = new Order(orderData);
    await order.save();

    await sendNotification(supplierId, {
      title: 'طلب جديد',
      message: `لديك طلب جديد من ${req.user.name} بكمية ${quantity} برميل`,
      type: 'info',
      data: { orderId: order._id }
    });

    res.status(201).json({ message: 'تم إنشاء الطلب', order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    الحصول على طلبات المستهلك
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ consumer: req.user._id })
      .populate('supplier', 'name phone')
      .sort('-createdAt');
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    إرسال تقييم متعدد الأبعاد لمورد (بعد التوصيل)
exports.rateSupplier = async (req, res) => {
  try {
    const { orderId, punctuality, waterQuality, cleanliness, professionalism, comment } = req.body;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'الطلب غير موجود' });
    if (order.consumer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'غير مصرح' });
    }
    if (order.status !== 'delivered' && order.status !== 'completed') {
      return res.status(400).json({ message: 'لا يمكن تقييم طلب غير مكتمل' });
    }

    const existing = await Rating.findOne({ order: orderId });
    if (existing) return res.status(400).json({ message: 'تم تقييم هذا الطلب مسبقاً' });

    const newRating = new Rating({
      order: orderId,
      consumer: req.user._id,
      supplier: order.supplier,
      punctuality,
      waterQuality,
      cleanliness,
      professionalism,
      comment
    });
    await newRating.save();

    // تحديث الطلب ببيانات التقييم (اختياري)
    order.rating = {
      punctuality,
      waterQuality,
      cleanliness,
      professionalism,
      comment,
      createdAt: new Date()
    };
    await order.save();

    res.json({ message: 'تم إرسال التقييم' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    الإبلاغ عن مورد
exports.reportSupplier = async (req, res) => {
  try {
    const { supplierId, orderId, reason, details } = req.body;
    const report = new Report({
      reporter: req.user._id,
      reportedUser: supplierId,
      order: orderId,
      reason,
      details
    });
    await report.save();

    // إشعار للأدمن (يمكن عبر WebSocket)
    // ...

    res.json({ message: 'تم إرسال البلاغ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    الحصول على الإشعارات
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
// ... الدوال السابقة ...

// @desc    الحصول على جميع الطلبات (للأدمن)
// @route   GET /api/admin/orders
exports.getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;
    const orders = await Order.find(filter)
      .populate('consumer', 'name phone')
      .populate('supplier', 'name phone')
      .sort('-createdAt');
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    الحصول على جميع التقييمات
// @route   GET /api/admin/ratings
exports.getAllRatings = async (req, res) => {
  try {
    const ratings = await Rating.find()
      .populate('consumer', 'name')
      .populate('supplier', 'name')
      .populate('order')
      .sort('-createdAt');
    res.json(ratings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    جلب تقييمات المستهلك
// @route   GET /api/consumer/ratings
exports.getMyRatings = async (req, res) => {
  try {
    const ratings = await Rating.find({ consumer: req.user._id })
      .populate('supplier', 'name')
      .populate('order');
    res.json(ratings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};