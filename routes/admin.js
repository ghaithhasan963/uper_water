const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const adminController = require('../controllers/adminController');

router.use(auth);
router.use(role('admin'));

router.get('/users', adminController.getUsers);
router.get('/users/:userId', adminController.getUserById);
router.get('/pending-users', adminController.getPendingUsers);
router.put('/users/:userId/review', adminController.reviewUser);
router.put('/users/:userId/toggle-suspend', adminController.toggleSuspend);
router.post('/users', adminController.createUser);
router.post('/reset-password', adminController.resetPassword);

router.get('/pending-edits', adminController.getPendingEdits);
router.put('/pending-edits/:editId', adminController.reviewEdit);

router.get('/reports', adminController.getReports);
router.put('/reports/:reportId', adminController.handleReport);

router.get('/activity', adminController.getActivityLogs);

// مسارات جديدة للطلبات والتقييمات
router.get('/orders', adminController.getAllOrders);
router.get('/ratings', adminController.getAllRatings);

module.exports = router;