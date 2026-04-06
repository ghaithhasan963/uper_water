const User = require('../models/User');
const Supplier = require('../models/Supplier');
const Consumer = require('../models/Consumer');
const Order = require('../models/Order');
const Rating = require('../models/Rating');
const Report = require('../models/Report');
const PendingEdit = require('../models/PendingEdit');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { sendNotification, emitActivity } = require('../socket');

// @desc    الحصول على جميع المستخدمين (مع فلترة)
// @route   GET /api/admin/users
exports.getUsers = async (req, res) => {
  try {
    const { role, status } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    const users = await User.find(filter).select('-password').sort('-createdAt');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    الحصول على طلبات التسجيل المعلقة مع كافة التفاصيل
// @route   GET /api/admin/pending-users
exports.getPendingUsers = async (req, res) => {
  try {
    // جلب المستخدمين المعلقين
    const users = await User.find({ status: 'pending' }).select('-password');
    
    // إضافة البيانات الإضافية حسب الدور
    const result = await Promise.all(users.map(async (user) => {
      const userObj = user.toObject();
      if (user.role === 'supplier') {
        const supplier = await Supplier.findOne({ user: user._id });
        if (supplier) {
          userObj.supplierDetails = supplier.toObject();
        }
      } else if (user.role === 'consumer') {
        const consumer = await Consumer.findOne({ user: user._id });
        if (consumer) {
          userObj.consumerDetails = consumer.toObject();
        }
      }
      return userObj;
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    مراجعة مستخدم جديد (تسجيل)
// @route   PUT /api/admin/users/:userId/review
exports.reviewUser = async (req, res) => {
  try {
    const { action, reason } = req.body; // action: approve / reject
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

    if (action === 'approve') {
      user.status = 'active';
      await user.save();

      // إشعار للمستخدم
      await sendNotification(user._id, {
        title: 'تم قبول حسابك',
        message: 'أهلاً بك في Uber Water، يمكنك البدء الآن',
        type: 'success'
      });

      await ActivityLog.create({ user: req.user._id, action: 'approve_user', details: { userId: user._id } });
      emitActivity({ type: 'user_approved', userId: user._id });

    } else if (action === 'reject') {
      user.status = 'rejected';
      user.rejectionReason = reason;
      await user.save();

      await sendNotification(user._id, {
        title: 'تم رفض حسابك',
        message: `للأسف، لم يتم قبول حسابك. السبب: ${reason || 'غير محدد'}`,
        type: 'error'
      });
    }

    res.json({ message: `تم ${action === 'approve' ? 'قبول' : 'رفض'} المستخدم` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    مراجعة طلبات تعديل المعلومات
// @route   GET /api/admin/pending-edits
exports.getPendingEdits = async (req, res) => {
  try {
    let edits = await PendingEdit.find({ status: 'pending' }).populate('user', 'name phone email role');

    // attach consumer/supplier details when available to help the admin review
    edits = await Promise.all(edits.map(async (e) => {
      const editObj = e.toObject();
      try {
        if (editObj.field && editObj.field.startsWith('consumer.')) {
          const consumer = await Consumer.findOne({ user: editObj.user._id });
          if (consumer) editObj.consumerDetails = consumer.toObject();
        } else if (editObj.field && editObj.field.startsWith('supplier.')) {
          const supplier = await Supplier.findOne({ user: editObj.user._id });
          if (supplier) editObj.supplierDetails = supplier.toObject();
        } else {
          // also attach any available consumer/supplier for inspection
          const consumer = await Consumer.findOne({ user: editObj.user._id });
          if (consumer) editObj.consumerDetails = consumer.toObject();
          const supplier = await Supplier.findOne({ user: editObj.user._id });
          if (supplier) editObj.supplierDetails = supplier.toObject();
        }
      } catch (innerErr) { console.error('attach details failed', innerErr); }
      return editObj;
    }));

    res.json(edits);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    الموافقة على تعديل أو رفضه
// @route   PUT /api/admin/pending-edits/:editId
exports.reviewEdit = async (req, res) => {
  try {
    const { action } = req.body; // approve / reject
    const edit = await PendingEdit.findById(req.params.editId).populate('user');
    if (!edit) return res.status(404).json({ message: 'طلب التعديل غير موجود' });

    if (action === 'approve') {
      // تطبيق التعديل على الحقل المناسب
      if (edit.field.startsWith('supplier.')) {
        const field = edit.field.replace('supplier.', '');
        await Supplier.findOneAndUpdate(
          { user: edit.user._id },
          { [field]: edit.newValue }
        );
      } else if (edit.field.startsWith('consumer.')) {
        const field = edit.field.replace('consumer.', '');
        await Consumer.findOneAndUpdate(
          { user: edit.user._id },
          { [field]: edit.newValue }
        );
      } else {
        // تعديل في User
        await User.findByIdAndUpdate(edit.user._id, { [edit.field]: edit.newValue });
      }
      edit.status = 'approved';
    } else {
      edit.status = 'rejected';
    }
    edit.reviewedBy = req.user._id;
    edit.reviewedAt = new Date();
    await edit.save();

    // إشعار للمستخدم بنتيجة الطلب
    await sendNotification(edit.user._id, {
      title: `طلب تعديل ${action === 'approve' ? 'مقبول' : 'مرفوض'}`,
      message: `تم ${action === 'approve' ? 'قبول' : 'رفض'} طلب تعديل ${edit.field}`,
      type: action === 'approve' ? 'success' : 'error'
    });

    res.json({ message: 'تمت المراجعة' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    حظر أو إلغاء حظر مستخدم
// @route   PUT /api/admin/users/:userId/toggle-suspend
exports.toggleSuspend = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

    user.status = user.status === 'suspended' ? 'active' : 'suspended';
    await user.save();

    await sendNotification(user._id, {
      title: user.status === 'suspended' ? 'تم تعليق حسابك' : 'تم إعادة تفعيل حسابك',
      message: user.status === 'suspended' ? 'لقد تم تعليق حسابك، تواصل مع الدعم للمزيد' : 'يمكنك استخدام حسابك الآن',
      type: 'warning'
    });

    res.json({ message: `تم ${user.status === 'suspended' ? 'تعليق' : 'إعادة تفعيل'} الحساب` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    إنشاء مستخدم جديد بواسطة الأدمن
// @route   POST /api/admin/users
exports.createUser = async (req, res) => {
  try {
    const { name, phone, email, password, role } = req.body;
    const existing = await User.findOne({ phone });
    if (existing) return res.status(400).json({ message: 'رقم الهاتف موجود مسبقاً' });

    const user = new User({ name, phone, email, password, role, status: 'active' });
    await user.save();

    res.status(201).json({ message: 'تم إنشاء المستخدم' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    إعادة تعيين كلمة المرور (إنشاء كلمة جديدة)
// @route   POST /api/admin/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

    const newPassword = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 100);
    user.password = newPassword;
    await user.save();

    await sendNotification(user._id, {
      title: 'تم إعادة تعيين كلمة المرور',
      message: `كلمة المرور الجديدة: ${newPassword}. يرجى تغييرها بعد تسجيل الدخول.`,
      type: 'info'
    });

    res.json({ message: 'تم إعادة تعيين كلمة المرور وإرسالها للمستخدم' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    عرض التقارير (البلاغات)
// @route   GET /api/admin/reports
exports.getReports = async (req, res) => {
  try {
    const reports = await Report.find({ status: 'pending' })
      .populate('reporter', 'name phone')
      .populate('reportedUser', 'name phone')
      .populate('order');
    res.json(reports);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    معالجة بلاغ
// @route   PUT /api/admin/reports/:reportId
exports.handleReport = async (req, res) => {
  try {
    const { action } = req.body; // resolve, dismiss
    const report = await Report.findById(req.params.reportId);
    if (!report) return res.status(404).json({ message: 'البلاغ غير موجود' });

    report.status = action === 'resolve' ? 'resolved' : 'dismissed';
    await report.save();

    res.json({ message: 'تمت معالجة البلاغ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    الحصول على النشاطات اللحظية (آخر 24 ساعة)
// @route   GET /api/admin/activity
exports.getActivityLogs = async (req, res) => {
  try {
    const logs = await ActivityLog.find()
      .populate('user', 'name phone')
      .sort('-createdAt')
      .limit(100);
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    جلب جميع الطلبات مع فلترة حسب الحالة (قيمة query `status` يمكن أن تكون مفصولة بفواصل)
// @route   GET /api/admin/orders
exports.getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    // دعم جلب الطلبات خلال آخر مدة معينة (بالساعات) أو آخر 24 ساعة
    if (req.query.last24 === 'true' || req.query.sinceHours) {
      const hours = req.query.sinceHours ? parseInt(req.query.sinceHours, 10) : 24;
      const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
      filter.createdAt = { $gte: cutoff };
    }
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length) filter.status = { $in: statuses };
    }
    const orders = await Order.find(filter)
      .populate('consumer', 'name phone')
      .populate('supplier', 'name phone');
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    جلب جميع التقييمات
// @route   GET /api/admin/ratings
exports.getAllRatings = async (req, res) => {
  try {
    const ratings = await Rating.find()
      .populate('consumer', 'name')
      .populate('supplier', 'name');
    res.json(ratings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

// @desc    الحصول على مستخدم واحد مع التفاصيل الكاملة
// @route   GET /api/admin/users/:userId
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });
    const userObj = user.toObject();
    if (user.role === 'supplier') {
      const supplier = await Supplier.findOne({ user: user._id });
      if (supplier) userObj.supplierDetails = supplier.toObject();
    } else if (user.role === 'consumer') {
      const consumer = await Consumer.findOne({ user: user._id });
      if (consumer) userObj.consumerDetails = consumer.toObject();
    }
    res.json(userObj);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};