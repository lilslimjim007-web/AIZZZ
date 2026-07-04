import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authAPI = {
  register: (username, password) => api.post('/auth/register', { username, password }),
  login: (username, password) => api.post('/auth/login', { username, password }),
};

export const userAPI = {
  getProfile: () => api.get('/user/profile'),
  getBalance: () => api.get('/user/balance'),
};

export const chatAPI = {
  sendMessage: (message, useCoins = false) => api.post('/chat', { message, useCoins }),
  getHistory: () => api.get('/chat/history'),
};

export const coinsAPI = {
  addCoins: (amount, description) => api.post('/coins/add', { amount, description }),
  spendCoins: (amount, description) => api.post('/coins/spend', { amount, description }),
};

export const storeAPI = {
  packages: () => api.get('/store/packages'),
  purchase: (packageId) => api.post('/store/purchase', { packageId }),
  verify: (sessionId) => api.post('/store/verify', { sessionId }),
};

export const premiumAPI = {
  subscribe: () => api.post('/premium/subscribe'),
};

export const giftsAPI = {
  list: () => api.get('/gifts'),
  buy: (giftId) => api.post('/gifts/buy', { giftId }),
};

export const personalityAPI = {
  get: () => api.get('/personality'),
  update: (name, personality) => api.put('/personality', { name, personality }),
};
