import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { clearTokens, getAccessToken, setTokens } from '../lib/authStorage';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
      return me;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clearTokens();
        setUser(null);
        return null;
      }
      throw e;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      try {
        const token = getAccessToken();
        if (token) {
          const me = await api.me();
          if (!cancelled) setUser(me);
        }
      } catch {
        clearTokens();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async ({ username, password }) => {
    const tok = await api.token({ username, password });
    setTokens({ access: tok.access, refresh: tok.refresh });
    const me = await api.me();
    setUser(me);
    return me;
  }, []);

  const register = useCallback(async ({ username, email, password }) => {
    await api.register({ username, email, password });
    return login({ username, password });
  }, [login]);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, isAuthenticated: !!user, isStaff: !!user?.is_staff, login, register, logout, refreshMe }),
    [user, loading, login, register, logout, refreshMe],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
