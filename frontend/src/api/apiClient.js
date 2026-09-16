// ============================================================
//  apiClient.js — Centralized API Request Helper for SmartHire
//  Handles cross-origin credential inclusion for HttpOnly cookies
// ============================================================

export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function getAuthToken() {
  try {
    return localStorage.getItem('smarthire_token') || localStorage.getItem('token') || '';
  } catch (_e) {
    return '';
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem('smarthire_token', token);
    } else {
      localStorage.removeItem('smarthire_token');
    }
  } catch (_e) {}
}

export function clearAuthToken() {
  try {
    localStorage.removeItem('smarthire_token');
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
  } catch (_e) {}
}

export function getAuthHeaders(customHeaders = {}) {
  const headers = { ...customHeaders };
  const token = getAuthToken();
  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Safely parses JSON from a fetch Response.
 * Prevents "Unexpected end of JSON input" errors when response body is empty,
 * plain text, HTML (502/504 errors), or invalid JSON.
 */
export async function safeJsonParse(res) {
  if (!res) return null;
  try {
    const text = await res.text();
    if (!text || !text.trim()) {
      return null;
    }
    try {
      return JSON.parse(text);
    } catch (_parseErr) {
      // If body is non-JSON string (e.g., error string or HTML), return as message
      return { message: text };
    }
  } catch (_readErr) {
    return null;
  }
}

export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint
    : `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = getAuthHeaders(options.headers || {});

  // Default to application/json if body is string (e.g. JSON.stringify) and Content-Type is not set
  const hasContentType = Object.keys(headers).some(
    (k) => k.toLowerCase() === 'content-type'
  );
  if (options.body && typeof options.body === 'string' && !hasContentType) {
    headers['Content-Type'] = 'application/json';
  }

  const mergedOptions = {
    credentials: 'include',
    ...options,
    headers,
  };

  return fetch(url, mergedOptions);
}


