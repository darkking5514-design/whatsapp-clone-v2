import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

// List of countries with codes and flags
const countries = [
  { code: '+92', flag: '🇵🇰', label: 'Pakistan' },
  { code: '+91', flag: '🇮🇳', label: 'India' },
  { code: '+1', flag: '🇺🇸', label: 'United States' },
  { code: '+44', flag: '🇬🇧', label: 'United Kingdom' },
  { code: '+61', flag: '🇦🇺', label: 'Australia' },
  { code: '+81', flag: '🇯🇵', label: 'Japan' },
  { code: '+86', flag: '🇨🇳', label: 'China' },
  { code: '+49', flag: '🇩🇪', label: 'Germany' },
  { code: '+33', flag: '🇫🇷', label: 'France' },
  { code: '+39', flag: '🇮🇹', label: 'Italy' },
  { code: '+34', flag: '🇪🇸', label: 'Spain' },
  { code: '+55', flag: '🇧🇷', label: 'Brazil' },
  { code: '+7', flag: '🇷🇺', label: 'Russia' },
  { code: '+82', flag: '🇰🇷', label: 'South Korea' },
  { code: '+966', flag: '🇸🇦', label: 'Saudi Arabia' },
  { code: '+971', flag: '🇦🇪', label: 'UAE' },
  { code: '+20', flag: '🇪🇬', label: 'Egypt' },
  { code: '+27', flag: '🇿🇦', label: 'South Africa' },
  { code: '+234', flag: '🇳🇬', label: 'Nigeria' },
  { code: '+254', flag: '🇰🇪', label: 'Kenya' },
];

export default function Login() {
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  // ---- Request OTP ----
  const requestOTP = async (e) => {
    e.preventDefault();
    if (!phoneNumber.trim()) {
      setError('Please enter your phone number.');
      return;
    }
    setError('');
    setLoading(true);

    const fullNumber = selectedCountry.code + phoneNumber.trim();

    try {
      const res = await api.post('/auth/request-otp', { phoneNumber: fullNumber });
      setIsNewUser(res.data.isNewUser || false);
      setDevOtp(res.data.devOtp || '');
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Verify OTP ----
  const verifyOTP = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Please enter the OTP.');
      return;
    }
    setError('');
    setLoading(true);

    const fullNumber = selectedCountry.code + phoneNumber.trim();

    try {
      const payload = { phoneNumber: fullNumber, otp };
      if (isNewUser && name.trim()) {
        payload.name = name.trim();
      }
      const res = await api.post('/auth/verify-otp', payload);
      if (res.data.success) {
        const userData = res.data.user;
        const tokenData = res.data.token;
        if (!userData.id) {
          setError('Login failed: User ID missing');
          setLoading(false);
          return;
        }
        localStorage.setItem('token', tokenData);
        localStorage.setItem('user', JSON.stringify(userData));
        login(userData, tokenData);
        setTimeout(() => navigate('/chats'), 100);
      } else {
        setError(res.data.message || 'Verification failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Helper to format display ----
  const formatPhoneDisplay = () => {
    if (!phoneNumber) return selectedCountry.code;
    return selectedCountry.code + ' ' + phoneNumber;
  };

  // ---- Render phone step ----
  if (step === 'phone') {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-6">
          {/* WhatsApp Logo / Icon */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full bg-whatsapp-green flex items-center justify-center mb-4">
              <MessageCircle className="text-white" size={32} />
            </div>
            <h1 className="text-2xl font-light text-gray-800">WhatsApp Clone</h1>
          </div>

          {/* Title */}
          <h2 className="text-center text-sm font-medium text-gray-600 mb-6">
            Enter your phone number
          </h2>

          {/* Phone Input */}
          <form onSubmit={requestOTP}>
            <div className="space-y-4">
              {/* Country selector */}
              <div className="relative">
                <select
                  value={selectedCountry.code}
                  onChange={(e) => {
                    const selected = countries.find(c => c.code === e.target.value);
                    if (selected) setSelectedCountry(selected);
                  }}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent bg-white"
                >
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.code} {country.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              </div>

              {/* Phone number */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone number</label>
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-whatsapp-green focus-within:border-transparent">
                  <span className="bg-gray-100 px-3 py-3 text-gray-600 font-medium">
                    {selectedCountry.code}
                  </span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setPhoneNumber(val);
                    }}
                    placeholder="3 0 0 1 2 3 4 5 6 7"
                    className="flex-1 px-3 py-3 outline-none text-gray-700 placeholder-gray-400"
                    required
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Use international format
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-whatsapp-green text-white font-medium rounded-full py-3 hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Next'}
              </button>

              <p className="text-center text-xs text-gray-400 mt-4">
                By continuing, you agree to our Terms & Privacy Policy.
              </p>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ---- OTP verification step ----
  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-6">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-whatsapp-green flex items-center justify-center mb-4">
            <MessageCircle className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-light text-gray-800">WhatsApp Clone</h1>
        </div>

        <h2 className="text-center text-sm font-medium text-gray-600 mb-6">
          Enter the OTP sent to {formatPhoneDisplay()}
        </h2>

        <form onSubmit={verifyOTP}>
          <div className="space-y-4">
            <div>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="6-digit code"
                maxLength={6}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                required
              />
              {devOtp && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  Testing OTP: <span className="font-mono text-whatsapp-green">{devOtp}</span>
                </p>
              )}
            </div>

            {isNewUser && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Your name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-whatsapp-green focus:border-transparent"
                  required
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-whatsapp-green text-white font-medium rounded-full py-3 hover:bg-green-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setError('');
                setOtp('');
              }}
              className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Go back
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}