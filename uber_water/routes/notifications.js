const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Subscription = require('../models/Subscription');
const webpush = require('web-push');

// تأكد من وجود المتغيرات البيئية
if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.warn('VAPID keys not set. Push notifications will not work.');
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@uberwater.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// الاشتراك في الإشعارات
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    // حذف أي اشتراك سابق بنفس endpoint
    await Subscription.findOneAndDelete({ endpoint });
    const subscription = new Subscription({
      user: req.user._id,
      endpoint,
      keys
    });
    await subscription.save();
    res.status(201).json({ message: 'تم الاشتراك في الإشعارات' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الاشتراك' });
  }
});

// إلغاء الاشتراك
router.post('/unsubscribe', auth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await Subscription.findOneAndDelete({ endpoint });
    res.json({ message: 'تم إلغاء الاشتراك' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في إلغاء الاشتراك' });
  }
});

// دالة مساعدة لإرسال الإشعار لمستخدم معين
async function sendPushToUser(userId, title, body, url = '/') {
  try {
    const subs = await Subscription.find({ user: userId });
    const payload = JSON.stringify({ title, body, url });
    const promises = subs.map(sub => 
      webpush.sendNotification(sub, payload).catch(err => {
        // إذا كان الاشتراك منتهي الصلاحية، احذفه
        if (err.statusCode === 410) {
          return Subscription.findByIdAndDelete(sub._id);
        }
        console.error('Push error:', err);
      })
    );
    await Promise.all(promises);
  } catch (err) {
    console.error('sendPushToUser error:', err);
  }
}

module.exports = { router, sendPushToUser };