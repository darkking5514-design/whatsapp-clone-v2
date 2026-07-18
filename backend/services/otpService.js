const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

const client = twilio(accountSid, authToken);

// ============================================
// SEND OTP via Twilio Verify (SMS)
// ============================================
async function sendOTP(phoneNumber) {
  try {
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({
        to: phoneNumber,
        channel: 'sms',
      });

    console.log(`📱 OTP sent via SMS to ${phoneNumber}`);
    console.log(`📋 Verification SID: ${verification.sid}`);
    console.log(`📋 Status: ${verification.status}`);

    return { success: true, sid: verification.sid };

  } catch (error) {
    console.error('❌ Twilio Verify Error:', error.message);
    console.error('📋 Error Code:', error.code);
    return { success: false, error: error.message };
  }
}

// ============================================
// VERIFY OTP using Twilio Verify
// ============================================
async function verifyOTPWithVerify(phoneNumber, code) {
  try {
    const verificationCheck = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({
        to: phoneNumber,
        code: code,
      });

    console.log(`✅ Verification check: ${verificationCheck.status}`);
    return { success: verificationCheck.status === 'approved' };

  } catch (error) {
    console.error('❌ Verification check error:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// VERIFY OTP (Database fallback)
// ============================================
function verifyOTP(user, otp) {
  if (user.otp !== otp) {
    return { success: false, message: 'Invalid OTP' };
  }
  if (user.otpExpiry < new Date()) {
    return { success: false, message: 'OTP expired' };
  }
  return { success: true };
}

module.exports = {
  sendOTP,
  verifyOTP,
  verifyOTPWithVerify,
};