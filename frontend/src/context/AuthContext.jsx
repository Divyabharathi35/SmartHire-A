import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiFetch, clearAuthToken, setAuthToken, safeJsonParse } from '../api/apiClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,            setUser]            = useState(null);
  const [isLoading,       setIsLoading]       = useState(true); // true while restoring session
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ── Restore session from HTTP-only cookie or Authorization token on mount ──
  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      // Check for OAuth redirect or token in URL
      const params = new URLSearchParams(window.location.search);
      const oauthResult = params.get('oauth');
      const urlToken = params.get('token');

      if (urlToken) {
        setAuthToken(urlToken);
      }

      if (oauthResult === 'error') {
        const provider = params.get('provider') || 'OAuth';
        const reason = params.get('reason');
        const msg = reason === 'deactivated'
          ? 'Account deactivated. Contact an administrator.'
          : reason === 'no_email'
            ? `Could not retrieve email from ${provider}. Please ensure your email is public or verified.`
            : `Sign in with ${provider} failed. Please try again.`;
        sessionStorage.setItem('oauth_error', msg);
        window.history.replaceState({}, '', window.location.pathname);
        setIsLoading(false);
        return;
      }

      if (oauthResult === 'success' || urlToken) {
        window.history.replaceState({}, '', window.location.pathname);
      }

      const res = await apiFetch('/api/auth/me', { method: 'GET' });
      if (res.ok) {
        const data = await safeJsonParse(res);
        const returnedUser = data?.user;
        if (returnedUser) {
          const normalizedRole = returnedUser?.role ? String(returnedUser.role).toLowerCase().trim() : null;
          
          console.log('[AuthContext] Session Restored User Object:', returnedUser);
          console.log('[AuthContext] Session Restored Role:', normalizedRole);

          setUser(returnedUser);
          setIsAuthenticated(true);
        } else {
          console.log('[AuthContext] Session Restore: res.ok true but no user data object');
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        console.log('[AuthContext] Session Restore: No active session (HTTP', res.status, ')');
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('[AuthContext] Error restoring session:', err);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Login ──
  const login = useCallback(async (email, password) => {
    console.log('[AuthContext] Executing login for:', email);
    const res = await apiFetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    const data = await safeJsonParse(res);
    console.log('[AuthContext] Login API Response (status ' + res.status + '):', data);

    if (!res.ok) {
      const errorMsg = data?.detail || data?.message || (res.status === 401 ? 'Invalid email or password' : `Login failed (HTTP ${res.status})`);
      throw new Error(errorMsg);
    }
    
    const returnedUser = data?.user;
    if (!returnedUser) {
      throw new Error('Login succeeded but user data was missing in response');
    }

    if (data?.token) {
      setAuthToken(data.token);
    }

    const normalizedRole = returnedUser?.role ? String(returnedUser.role).toLowerCase().trim() : null;

    console.log('[AuthContext] Stored User Object:', returnedUser);
    console.log('[AuthContext] Current Authenticated Role:', normalizedRole);

    setUser(returnedUser);
    setIsAuthenticated(true);
    return returnedUser;
  }, []);

  // ── Register ──
  const register = useCallback(async (name, email, password, role) => {
    console.log('[AuthContext] Registering user with role:', role);
    const res = await apiFetch('/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, email, password, role }),
    });
    const data = await safeJsonParse(res);
    console.log('[AuthContext] Register API Response:', data);

    if (!res.ok) {
      if (data?.errors?.length) throw new Error(data.errors[0].msg);
      throw new Error(data?.detail || data?.message || `Registration failed (HTTP ${res.status})`);
    }
    
    const returnedUser = data?.user;
    if (!returnedUser) {
      throw new Error('Registration succeeded but user data was missing in response');
    }

    if (data?.token) {
      setAuthToken(data.token);
    }

    const normalizedRole = returnedUser?.role ? String(returnedUser.role).toLowerCase().trim() : null;

    console.log('[AuthContext] Stored Registered User Object:', returnedUser);
    console.log('[AuthContext] Current Authenticated Role:', normalizedRole);

    setUser(returnedUser);
    setIsAuthenticated(true);
    return returnedUser;
  }, []);


  // ── Logout ──
  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (_err) { /* ignore */ }
    clearAuthToken();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const normalizedRole = user?.role ? String(user.role).toLowerCase().trim() : null;

  const value = {
    user,
    role: normalizedRole,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    apiFetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
