const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// استيراد نموذج المستخدم (تأكد من المسار صحيح)
const User = require('./models/User');

async function createAdmin() {
  try {
    // الاتصال بقاعدة البيانات
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ متصل بقاعدة البيانات');

    // بيانات الأدمن المطلوبة
    const adminData = {
      name: 'sleman123',
      phone: '961000000000', // يمكنك تغيير الرقم
      email: 'admin@uberwater.com',
      password: 'Sleman123$', // سيتم تشفيرها تلقائياً
      role: 'admin',
      status: 'active'
    };

    // التحقق من عدم وجود أدمن بنفس الرقم
    const existing = await User.findOne({ phone: adminData.phone });
    if (existing) {
      console.log('⚠️ يوجد مستخدم بهذا الرقم بالفعل');
      return process.exit();
    }

    // إنشاء الأدمن (كلمة المرور ستُشفر تلقائياً في الـ pre-save hook)
    const admin = new User(adminData);
    await admin.save();

    console.log('✅ تم إنشاء حساب الأدمن بنجاح');
    console.log('📱 رقم الهاتف:', adminData.phone);
    console.log('🔑 كلمة المرور:', adminData.password);
    console.log('➡️ يمكنك الدخول الآن من صفحة /login.html');

  } catch (err) {
    console.error('❌ خطأ:', err);
  } finally {
    mongoose.disconnect();
  }
}

createAdmin();