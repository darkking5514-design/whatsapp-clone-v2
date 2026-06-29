const mongoose = require('mongoose');

const uri = 'mongodb://localhost:27017/whatsapp-clone';

console.log('🔍 Testing local MongoDB connection...');

mongoose.connect(uri)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!');
    console.log('📋 Database:', mongoose.connection.db.databaseName);
    mongoose.connection.close();
    console.log('✅ Connection closed');
  })
  .catch((err) => {
    console.error('❌ Connection error:', err.message);
  });