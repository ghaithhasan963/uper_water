const User = require('../models/User');
const Supplier = require('../models/Supplier');
const Consumer = require('../models/Consumer');
const ActivityLog = require('../models/ActivityLog');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const cities = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/lebanon-cities.json'), 'utf8'));

exports.register = async (req, res) => {
  try {
    const { role, name, phone, email, password, ...rest } = req.body;
    let user = await User.findOne({ phone });
    if (user) return res.status(400).json({ message: 'رقم الهاتف مسجل مسبقاً' });

    user = new User({ name, phone, email, password, role });
    await user.save();

    if (role === 'supplier') {
      const { tankCapacity, plateNumber, serviceAreas } = rest;
      const supplier = new Supplier({
        user: user._id,
        tankCapacity,
        plateNumber,
        serviceAreas: JSON.parse(serviceAreas)
      });
      if (req.file) supplier.tankImage = '/uploads/' + req.file.filename;
      await supplier.save();
    } else if (role === 'consumer') {
      const { address, location, city, district } = rest;
      const consumer = new Consumer({
        user: user._id,
        address,
        location: { type: 'Point', coordinates: JSON.parse(location) },
        city,
        district
      });
      await consumer.save();
    }

    await ActivityLog.create({ user: user._id, action: 'register', details: { role }, ip: req.ip });
    res.status(201).json({ message: 'تم التسجيل بنجاح، في انتظار مراجعة المشرف' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ message: 'المستخدم غير موجود' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'كلمة مرور خاطئة' });

    if (user.status !== 'active') {
      return res.status(403).json({ message: `حسابك غير نشط: ${user.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}` });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, secure: process.env.NODE_ENV === 'production' });

    await ActivityLog.create({ user: user._id, action: 'login', ip: req.ip });

    res.json({ role: user.role, redirect: `/${user.role}/dashboard.html` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في الخادم' });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'تم تسجيل الخروج بنجاح', redirect: '/' });
};

exports.getCities = (req, res) => {
  res.json(cities);
};