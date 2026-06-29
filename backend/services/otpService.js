// ============================================
// OTP SERVICE - WhatsApp OTP via Twilio
// ============================================

const twilio = require('twilio');

// ============================================
// Get credentials from environment variables
// ============================================
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886';

console.log('🔍 Twilio Config Check:');
console.log('Account SID:', accountSid ? '✅ Loaded' : '❌ NOT FOUND');
console.log('Auth Token:', authToken ? '✅ Loaded' : '❌ NOT FOUND');
console.log('From Number:', fromNumber || '❌ NOT FOUND');

// Initialize Twilio client
const client = twilio(accountSid, authToken);

// ============================================
// SEND OTP - WhatsApp
// ============================================
async function sendOTP(phoneNumber, otp) {
  try {
    console.log(`📱 Sending OTP ${otp} to ${phoneNumber}...`);

    // Format numbers for WhatsApp
    const to = `whatsapp:${phoneNumber}`;
    const from = `whatsapp:${fromNumber}`;

    console.log('📋 To:', to);
    console.log('📋 From:', from);

    // Send message via Twilio WhatsApp
    const message = await client.messages.create({
      body: `Your WhatsApp Clone OTP is: ${otp}\nValid for 5 minutes.`,
      from: from,
      to: to,
    });

    console.log('✅ OTP sent via WhatsApp! SID:', message.sid);
    return { success: true, sid: message.sid };

  } catch (error) {
    console.error('❌ Twilio Error:', error.message);
    console.error('📋 Error Code:', error.code);
    console.error('📋 More Info:', error.moreInfo);
    return { success: false, error: error.message };
  }
}

// ============================================
// VERIFY OTP (Database check)
// ============================================
function verifyOTP(user, otp) {
  // Check if OTP matches
  if (user.otp !== otp) {
    return { success: false, message: 'Invalid OTP' };
  }

  // Check if OTP is expired
  if (user.otpExpiry < new Date()) {
    return { success: false, message: 'OTP expired. Please request a new one.' };
  }

  return { success: true };
}

// ============================================
// EXPORT MODULES
// ============================================
module.exports = {
  sendOTP,
  verifyOTP,
};