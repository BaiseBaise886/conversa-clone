import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

let token = localStorage.getItem('token');
export let socket = null;

export const setToken = (newToken) => {
  token = newToken;
  localStorage.setItem('token', newToken);
};

export const getToken = () => {
  return token || localStorage.getItem('token');
};

export const clearAuth = () => {
  token = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('organization');
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const apiCall = async (endpoint, options = {}) => {
  const currentToken = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(currentToken && { Authorization: `Bearer ${currentToken}` }),
    ...options.headers
  };

  // Remove Content-Type for FormData
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const config = {
    method: options.method || 'GET',
    headers,
    ...options
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    if (response.status === 401) {
      clearAuth();
      window.location.reload();
      throw new Error('Session expired. Please login again.');
    }

    const contentType = response.headers.get('content-type');
    let data;
    
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

export const connectWebSocket = () => {
  const currentToken = getToken();
  
  if (!currentToken) {
    console.warn('No token available for WebSocket connection');
    return;
  }

  if (socket && socket.connected) {
    console.log('WebSocket already connected');
    return socket;
  }

  socket = io(WS_URL, {
    auth: {
      token: currentToken
    },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('✅ WebSocket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ WebSocket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error);
    if (error.message.includes('Authentication')) {
      clearAuth();
      window.location.reload();
    }
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Global event listeners
  socket.on('new_message', (data) => {
    console.log('📨 New message:', data);
  });

  socket.on('user_presence', (data) => {
    console.log('👤 User presence:', data);
  });

  socket.on('whatsapp_qr', (data) => {
    console.log('📱 WhatsApp QR:', data);
  });

  socket.on('whatsapp_connected', (data) => {
    console.log('✅ WhatsApp connected:', data);
  });

  socket.on('whatsapp_disconnected', (data) => {
    console.log('❌ WhatsApp disconnected:', data);
  });

  return socket;
};

export const disconnectWebSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('WebSocket disconnected');
  }
};

export default {
  apiCall,
  setToken,
  getToken,
  clearAuth,
  connectWebSocket,
  disconnectWebSocket,
  socket
};