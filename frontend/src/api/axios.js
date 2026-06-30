import axios from 'axios';

// ============================================
// API & SOCKET URLS - Production (Railway)
// ============================================
// Vercel environment variable se lein, nahi toh production URL use karein
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://whatsapp-clone-v2-production.up.railway.app/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://whatsapp-clone-v2-production.up.railway.app';

console.log('🔌 API_BASE_URL:', API_BASE_URL);
console.log('🔌 SOCKET_URL:', SOCKET_URL);

// ============================================
// AXIOS INSTANCE
// ============================================
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// REQUEST INTERCEPTOR - Add Token
// ============================================
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`📤 API Request: ${config.method?.toUpperCase() || 'GET'} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// ============================================
// RESPONSE INTERCEPTOR
// ============================================
api.interceptors.response.use(
  (response) => {
    console.log(`📥 API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`❌ API Error: ${error.response?.status || 'Network'} ${error.config?.url || ''}`);
    return Promise.reject(error);
  }
);

// ============================================
// EXPORTS
// ============================================
export { API_BASE_URL, SOCKET_URL };
export default api;