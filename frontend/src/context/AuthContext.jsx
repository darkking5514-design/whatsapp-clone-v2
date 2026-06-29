import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function hydrate() {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      console.log('🔍 Hydrating auth...');
      console.log('📋 Stored Token:', storedToken ? '✅ Exists' : '❌ Not found');

      if (!storedToken) {
        setLoading(false);
        return;
      }

      // Try to get user from localStorage first
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log('👤 User from localStorage:', parsedUser);
          if (parsedUser.id) {
            setUser(parsedUser);
            setToken(storedToken);
            setLoading(false);
            console.log('✅ User loaded from localStorage');
            console.log('🔑 User ID:', parsedUser.id);
            return;
          }
        } catch (e) {
          console.error('❌ Failed to parse stored user');
        }
      }

      // Fallback: fetch from API
      try {
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        const res = await api.get('/auth/me');
        console.log('✅ Auth me response:', res.data);

        if (res.data.user) {
          setUser(res.data.user);
          setToken(storedToken);
          localStorage.setItem('user', JSON.stringify(res.data.user));
          console.log('👤 User set from API:', res.data.user);
          console.log('🔑 User ID:', res.data.user.id);
        }
      } catch (err) {
        console.error('❌ Auth hydrate error:', err.message);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete api.defaults.headers.common['Authorization'];
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    hydrate();
  }, []);

  function login(userData, tokenData) {
    console.log('🔍 Login called with:', { userData, tokenData });
    console.log('🔑 User ID:', userData?.id);
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem('token', tokenData);
    localStorage.setItem('user', JSON.stringify(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${tokenData}`;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}