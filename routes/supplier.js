const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const supplierController = require('../controllers/supplierController');

router.use(auth);
router.use(role('supplier'));

router.get('/profile', supplierController.getProfile);
router.put('/status', supplierController.updateStatus);
router.post('/edit-request', supplierController.requestEdit);
router.put('/settings', supplierController.updateSettings);
router.get('/orders', supplierController.getOrders);
router.get('/appointments', supplierController.getAppointments);
router.get('/ratings', supplierController.getMyRatings);
router.put('/orders/:orderId/accept', supplierController.acceptOrder);
router.put('/orders/:orderId/status', supplierController.updateOrderStatus);
router.put('/orders/:orderId/reject', supplierController.rejectOrder);
router.get('/notifications', supplierController.getNotifications);
router.put('/notifications/:id/read', supplierController.markNotificationRead);

module.exports = router;