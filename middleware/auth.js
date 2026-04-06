const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'غير مصرح به، يرجى تسجيل الدخول' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ message: 'المستخدم غير موجود' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'حسابك غير نشط' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      res.clearCookie('token');
      return res.status(401).json({ message: 'الجلسة منتهية، يرجى تسجيل الدخول مجدداً' });
    }
    res.status(500).json({ message: 'خطأ في المصادقة' });
  }
};