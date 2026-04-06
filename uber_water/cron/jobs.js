const cron = require('node-cron');
const Order = require('../models/Order');
const { sendNotification } = require('../socket');
const ActivityLog = require('../models/ActivityLog');

// كل دقيقة، تحقق من الطلبات المعلقة الأقدم من 15 دقيقة وألغها
cron.schedule('* * * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const pendingOrders = await Order.find({
      status: 'pending',
      createdAt: { $lt: cutoff }
    });

    for (const order of pendingOrders) {
      order.status = 'auto-cancelled';
      order.cancelledAt = new Date();
      await order.save();

      await sendNotification(order.consumer, {
        title: 'تم إلغاء الطلب تلقائياً',
        message: 'لم يستجب المورد خلال 15 دقيقة، تم إلغاء الطلب.',
        type: 'error'
      });

      await sendNotification(order.supplier, {
        title: 'طلب ملغي',
        message: 'تم إلغاء الطلب لعدم استجابتك خلال 15 دقيقة.',
        type: 'warning'
      });
    }
  } catch (err) {
    console.error('Cron job error:', err);
  }
});

// كل يوم في منتصف الليل، احذف سجلات النشاط الأقدم من 24 ساعة
cron.schedule('0 0 * * *', async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await ActivityLog.deleteMany({ createdAt: { $lt: oneDayAgo } });
    console.log('Deleted old activity logs');
  } catch (err) {
    console.error('Error deleting logs:', err);
  }
});

// كل ساعة: احذف الطلبات الأقدم من 24 ساعة (تنظيف آلي)
cron.schedule('0 * * * *', async () => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const res = await Order.deleteMany({ createdAt: { $lt: oneDayAgo } });
    if (res.deletedCount && res.deletedCount > 0) {
      console.log(`Deleted ${res.deletedCount} orders older than 24 hours`);
    }
  } catch (err) {
    console.error('Error deleting old orders:', err);
  }
});