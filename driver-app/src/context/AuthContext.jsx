import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext(null);

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/auth';

// Attach JWT to every axios request automatically
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // On mount, validate a stored token and restore the session
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await axios.get(`${API}/me`);
        setUser(data.user);
      } catch {
        // Token expired or invalid — clear it
        localStorage.removeItem('token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  // Driver registration
  const register = async ({ email, password, phone }) => {
    try {
      setError(null);
      const { data } = await axios.post(`${API}/register/driver`, {
        email,
        password,
        phone,
      });
      localStorage.setItem('token', data.token);
      setUser(data.user);
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed.';
      setError(msg);
      throw err;
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const { data } = await axios.post(`${API}/login`, { email, password });
      localStorage.setItem('token', data.token);
      setUser(data.user);
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed.';
      setError(msg);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, register, logout, setError }}>
      {children}
    </AuthContext.Provider>
  );
};
