// ============================================
// SERVER.JS – COMPLETE BACKEND (FIXED)
// ============================================

// Load environment variables
require('dotenv').config({ path: './.env' });

console.log('🔍 ===== ENVIRONMENT VARIABLES CHECK =====');
console.log('📋 MONGO_URI:', process.env.MONGO_URI ? '✅ Loaded' : '❌ NOT FOUND');
console.log('📋 JWT_SECRET:', process.env.JWT_SECRET ? '✅ Loaded' : '❌ NOT FOUND');
console.log('📋 TWILIO_ACCOUNT_SID:', process.env.TWILIO_ACCOUNT_SID ? '✅ Loaded' : '❌ NOT FOUND');
console.log('📋 TWILIO_AUTH_TOKEN:', process.env.TWILIO_AUTH_TOKEN ? '✅ Loaded' : '❌ NOT FOUND');
console.log('📋 TWILIO_WHATSAPP_NUMBER:', process.env.TWILIO_WHATSAPP_NUMBER || '❌ NOT FOUND');
console.log('🔍 =========================================\n');

const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

// ---- Routes ----
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const statusRoutes = require('./routes/status');
const chatRoutes = require('./routes/chat');
const friendRoutes = require('./routes/friends');
const callRoutes = require('./routes/calls');
const groupRoutes = require('./routes/groups');

// ---- Socket ----
const { initSocket } = require('./socket/index');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/whatsapp-clone';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const allowedOrigins = CLIENT_URL.split(',').map((o) => o.trim());

console.log('🚀 ===== SERVER STARTING =====');
console.log('📋 PORT:', PORT);
console.log('📋 Allowed Origins:', allowedOrigins);
console.log('📋 MONGO_URI:', MONGO_URI ? '✅ Loaded' : '❌ NOT FOUND');

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json());

// ---- Static Files ----
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log('📁 Uploads folder created');
}
app.use('/uploads', express.static(uploadsPath));

// ---- API Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/groups', groupRoutes);

// ---- Health Check ----
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
  });
});

// ---- Root Route ----
app.get('/', (req, res) => {
  res.send('WhatsApp Clone Backend is running!');
});

// ---- Socket.IO Endpoint Test ----
app.get('/socket.io', (req, res) => {
  res.send('Socket.IO endpoint is active');
});

// ---- Socket.IO Setup ----
console.log('🔌 Initializing Socket.IO...');
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST'],
  },
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  allowEIO3: true,
});

initSocket(io);
console.log('✅ Socket.IO initialized');

// ---- MongoDB Connection ----
console.log('🔍 Connecting to MongoDB...');

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    console.log('📋 Database Name:', mongoose.connection.db.databaseName);

    server.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
      console.log(`✅ Socket.IO path: /socket.io`);
      console.log('🚀 ===== SERVER READY =====');
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ---- Graceful Shutdown ----
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