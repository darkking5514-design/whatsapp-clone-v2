import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Login() {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  // ============================================
  // 1. REQUEST OTP
  // ============================================
  async function requestOTP(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('📱 Sending OTP request for:', phoneNumber);

    try {
      const res = await api.post('/auth/request-otp', { phoneNumber });
      console.log('✅ OTP Response:', res.data);

      setIsNewUser(res.data.isNewUser || false);
      setDevOtp(res.data.devOtp || '');
      setStep('otp');

    } catch (err) {
      console.error('❌ OTP Error:', err);
      console.error('❌ Error Response:', err.response);
      setError(err.response?.data?.message || 'Failed to request OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ============================================
  // 2. VERIFY OTP
  // ============================================
  async function verifyOTP(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = { phoneNumber, otp };
      if (isNewUser && name.trim()) {
        payload.name = name.trim();
      }

      console.log('🔍 Verifying OTP payload:', payload);

      const res = await api.post('/auth/verify-otp', payload);
      console.log('✅ Verify Response:', res.data);

      if (res.data.success) {
        const userData = res.data.user;
        const tokenData = res.data.token;

        console.log('👤 User Data:', userData);
        console.log('🔑 User ID:', userData?.id);

        // ✅ IMPORTANT: Check if user has ID
        if (!userData.id) {
          console.error('❌ User ID is missing in response!');
          setError('Login failed: User ID missing');
          setLoading(false);
          return;
        }

        // Store in localStorage
        localStorage.setItem('token', tokenData);
        localStorage.setItem('user', JSON.stringify(userData));

        // Login via context
        login(userData, tokenData);

        // Wait a bit for context to update
        setTimeout(() => {
          navigate('/chats');
        }, 100);
      } else {
        setError(res.data.message || 'Verification failed');
      }
    } catch (err) {
      console.error('❌ Verify Error:', err);
      console.error('❌ Error Response:', err.response);
      setError(err.response?.data?.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#111b21] px-4">
      <div className="w-full max-w-sm bg-[#202c33] rounded-lg shadow-xl p-8">
        {/* Logo and Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-whatsapp-green flex items-center justify-center mb-3">
            <MessageCircle className="text-black" size={28} />
          </div>
          <h1 className="text-xl font-semibold text-white">WhatsApp Clone</h1>
          <p className="text-sm text-gray-400 mt-1">
            {step === 'phone'
              ? 'Enter your phone number'
              : 'Enter OTP sent to your phone'}
          </p>
        </div>

        {/* ============================================
            STEP 1: PHONE NUMBER
            ============================================ */}
        {step === 'phone' ? (
          <form onSubmit={requestOTP} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Phone Number</label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+923001234567"
                className="w-full rounded-md bg-[#2a3942] text-white px-3 py-2 outline-none focus:ring-2 focus:ring-whatsapp-green"
              />
              <p className="text-xs text-gray-500 mt-1">
                Use international format: +923001234567
              </p>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-md px-3 py-2">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-whatsapp-green text-black font-medium rounded-md py-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </span>
              ) : (
                'Send OTP'
              )}
            </button>

            {devOtp && (
              <p className="text-xs text-gray-400 text-center">
                (Testing OTP: <span className="font-mono text-yellow-400">{devOtp}</span>)
              </p>
            )}
          </form>
        ) : (
          /* ============================================
             STEP 2: OTP VERIFICATION
             ============================================ */
          <form onSubmit={verifyOTP} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Enter OTP</label>
              <input
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit OTP"
                maxLength={6}
                className="w-full rounded-md bg-[#2a3942] text-white px-3 py-2 outline-none focus:ring-2 focus:ring-whatsapp-green"
              />
              <p className="text-xs text-gray-500 mt-1">
                {devOtp && `Testing OTP: ${devOtp}`}
              </p>
            </div>

            {isNewUser && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-md bg-[#2a3942] text-white px-3 py-2 outline-none focus:ring-2 focus:ring-whatsapp-green"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-md px-3 py-2">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-whatsapp-green text-black font-medium rounded-md py-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Verify & Login'
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setError('');
              }}
              className="text-sm text-gray-400 hover:underline w-full text-center"
            >
              ← Go back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}