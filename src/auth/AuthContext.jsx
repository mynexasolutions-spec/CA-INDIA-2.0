import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, getAuthToken, setAuthToken } from '../api/client';

const AuthContext = createContext(null);
const IDLE_MS = 30 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef(null);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: {} });
    } catch {
      /* ignore */
    }
    setAuthToken(null);
    setUser(null);
  }, []);

  const bump = useCallback(() => {
    if (!getAuthToken()) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      logout().then(() => {
        if (window.location.pathname.startsWith('/portal') || window.location.pathname.startsWith('/admin')) {
          window.location.href = '/login?timeout=1';
        }
      });
    }, IDLE_MS);
  }, [logout]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    bump();
    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [bump]);

  const refresh = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const data = await api('/auth/me');
      setUser(data.user);
      bump();
      return data.user;
    } catch {
      setAuthToken(null);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [bump]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password, portal = null, remember = true) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: portal ? { email, password, portal } : { email, password },
    });
    // Two-Factor (Email OTP) accounts get no session yet: the emailed code must be verified first.
    if (data.two_factor) {
      return { twoFactor: true, challenge: data.challenge, email: data.email, devOtp: data._dev_otp ?? null };
    }
    setAuthToken(data.token, remember);
    setUser(data.user);
    bump();
    return data.user;
  }, [bump]);

  const verifyLoginOtp = useCallback(async (challenge, otp, remember = true) => {
    const data = await api('/auth/login/verify-otp', { method: 'POST', body: { challenge, otp } });
    setAuthToken(data.token, remember);
    setUser(data.user);
    bump();
    return data.user;
  }, [bump]);

  const value = useMemo(
    () => ({ user, loading, login, verifyLoginOtp, logout, refresh }),
    [user, loading, login, verifyLoginOtp, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
