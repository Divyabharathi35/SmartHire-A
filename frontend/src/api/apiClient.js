// ============================================================
//  apiClient.js — Centralized API Request Helper for SmartHire
//  Handles cross-origin credential inclusion for HttpOnly cookies
// ============================================================

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function getAuthToken() {
  return '';
}

export function setAuthToken(_token) {
  // No-op: Auth tokens are delivered strictly via HttpOnly cookies
}

export function clearAuthToken() {
  localStorage.removeItem('smarthire_token');
  localStorage.removeItem('token');
  localStorage.removeItem('access_token');
}

export function getAuthHeaders(customHeaders = {}) {
  const headers = { ...customHeaders };
  delete headers['Authorization'];
  return headers;
}

export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = getAuthHeaders(options.headers || {});

  const mergedOptions = {
    credentials: 'include',
    ...options,
    headers,
  };

  return fetch(url, mergedOptions);
}

