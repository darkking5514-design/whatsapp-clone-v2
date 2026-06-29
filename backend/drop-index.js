const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://localhost:27017/whatsapp-clone';

async function dropIndex() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected!');

    const db = mongoose.connection.db;
    
    // Check existing indexes
    const indexes = await db.collection('users').indexes();
    console.log('📋 Existing indexes:', indexes.map(i => i.name));

    // Drop email_1 index if exists
    try {
      await db.collection('users').dropIndex('email_1');
      console.log('✅ email_1 index dropped successfully!');
    } catch (err) {
      if (err.message.includes('index not found')) {
        console.log('⚠️ email_1 index already does not exist');
      } else {
        console.error('❌ Error dropping index:', err.message);
      }
    }

    // Drop users collection (optional - if you want fresh start)
    // await db.collection('users').drop();
    // console.log('✅ Users collection dropped');

    console.log('✅ Done!');
    await mongoose.connection.close();
    console.log('✅ Connection closed');

  } catch (err) {
    console.error('❌ Error:', err.message);
    await mongoose.connection.close();
  }
}

dropIndex();