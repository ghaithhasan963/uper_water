const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const role = require('../middleware/role');
const consumerController = require('../controllers/consumerController');

router.use(auth);
router.use(role('consumer'));

router.get('/profile', consumerController.getProfile);
router.put('/location', consumerController.updateLocation);
router.post('/edit-request', consumerController.requestEdit);
router.post('/filter-suppliers', consumerController.filterSuppliers);
router.post('/order', consumerController.createOrder);
router.get('/orders', consumerController.getOrders);
router.get('/ratings', consumerController.getMyRatings);
router.post('/rate', consumerController.rateSupplier);
router.post('/report', consumerController.reportSupplier);
router.get('/notifications', consumerController.getNotifications);

module.exports = router;