import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import api, { TOKEN_KEY, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);

    (async () => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        setUser(res.data.user);
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [clearSession]);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', {
      a_username: username,
      a_password: password,
    });
    await SecureStore.setItemAsync(TOKEN_KEY, res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore logout API errors locally, same as web client
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, login, logout, isAuthenticated: Boolean(user) }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
