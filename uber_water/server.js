const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.static(path.join(__dirname, 'public')));

// التأكد من وجود مجلد uploads
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Database connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Socket.io
require('./socket')(io);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/supplier', require('./routes/supplier'));
app.use('/api/consumer', require('./routes/consumer'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/orders', require('./routes/order'));
app.use('/api/notifications', require('./routes/notifications').router);
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/support', require('./routes/support'));
app.use('/api/verification', require('./routes/verification'));

// Cron jobs
require('./cron/jobs');

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));