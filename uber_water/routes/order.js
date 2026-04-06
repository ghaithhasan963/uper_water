const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const orderController = require('../controllers/orderController');

router.use(auth);

router.get('/:orderId', orderController.getOrderDetails);
router.put('/:orderId/cancel', orderController.cancelOrder);
router.get('/supplier/:supplierId/ratings', orderController.getSupplierRatings);

module.exports = router;