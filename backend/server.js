// ============================================
// SERVER.JS - WhatsApp Clone Backend
// ============================================

// Load environment variables
require('dotenv').config({ path: './.env' });

// ============================================
// DEBUG - Check environment variables
// ============================================
console.log('🔍 ===== ENVIRONMENT VARIABLES CHECK =====');
console.log('📋 PORT from env:', process.env.PORT || 'Not set');
console.log('📋 MONGO_URI:', process.env.MONGO_URI ? '✅ Loaded' : '❌ NOT FOUND');
console.log('📋 JWT_SECRET:', process.env.JWT_SECRET ? '✅ Loaded' : '❌ NOT FOUND');
console.log('📋 TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '✅ Loaded' : '❌ NOT FOUND');
console.log('📋 TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? '✅ Loaded' : '❌ NOT FOUND');
console.log('📋 TWILIO_WHATSAPP_NUMBER:', process.env.TWILIO_WHATSAPP_NUMBER || '❌ NOT FOUND');
console.log('🔍 =========================================\n');

// ============================================
// IMPORT DEPENDENCIES
// ============================================
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const statusRoutes = require('./routes/status');
const { initSocket } = require('./socket/index');

// ============================================
// INITIALIZE APP
// ============================================
const app = express();
const server = http.createServer(app);

// ============================================
// ENVIRONMENT VARIABLES
// ============================================
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/whatsapp-clone';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

console.log('🚀 ===== SERVER STARTING =====');
console.log('📋 PORT:', PORT);
console.log('📋 MONGO_URI:', MONGO_URI ? '✅ Loaded' : '❌ NOT FOUND');
console.log('📋 CLIENT_URL:', CLIENT_URL);

// ============================================
// CORS CONFIGURATION
// ============================================
const allowedOrigins = CLIENT_URL.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());

// ============================================
// STATIC FILES (Uploads)
// ============================================
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log('📁 Uploads folder created');
}
app.use('/uploads', express.static(uploadsPath));

// ============================================
// API ROUTES
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/status', statusRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// SOCKET.IO SETUP
// ============================================
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
  },
});

initSocket(io);

// ============================================
// MONGODB CONNECTION
// ============================================
console.log('🔍 Connecting to MongoDB...');

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    console.log('📋 Database Name:', mongoose.connection.db.databaseName);

    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
      console.log('🚀 ===== SERVER READY =====');
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    console.error('❌ Please check your MONGO_URI');
    process.exit(1);
  });

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  mongoose.connection.close(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  mongoose.connection.close(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});