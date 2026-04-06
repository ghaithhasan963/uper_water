const express = require('express');
const router = express.Router();
const { register, login, logout, getCities, getMe } = require('../controllers/authController');
const upload = require('../middleware/upload');
const auth = require('../middleware/auth');

router.post('/register', upload.single('tankImage'), register);
router.post('/login', login);
router.get('/logout', logout);
router.get('/cities', getCities);
router.get('/me', auth, getMe);  

module.exports = router;