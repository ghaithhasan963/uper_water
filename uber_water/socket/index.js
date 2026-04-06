const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');

let ioInstance;

module.exports = (io) => {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log('New client connected');

    const userId = socket.handshake.query.userId;
    if (userId) {
      socket.join(`user_${userId}`);
    }

    socket.on('joinAdmin', () => {
      socket.join('admin');
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
};

// دالة مساعدة لإرسال إشعار لمستخدم معين
async function sendNotification(userId, notificationData) {
  try {
    const notification = new Notification({ user: userId, ...notificationData });
    await notification.save();
    if (ioInstance) {
      ioInstance.to(`user_${userId}`).emit('notification', notification);
    }
  } catch (err) {
    console.error('Error sending notification:', err);
  }
}

// دالة لبث نشاط للمشرفين
async function emitActivity(activity) {
  try {
    if (ioInstance) {
      ioInstance.to('admin').emit('activity', activity);
    }
    // يمكن تخزين النشاط في قاعدة البيانات هنا أو في مكان آخر
    await ActivityLog.create(activity);
  } catch (err) {
    console.error('Error emitting activity:', err);
  }
}

module.exports.sendNotification = sendNotification;
module.exports.emitActivity = emitActivity;