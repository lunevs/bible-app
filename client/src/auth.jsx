import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.get('/auth/me');
      setUser(user);
      return user;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = async (login, password) => {
    const { user } = await api.post('/auth/login', { login, password });
    setUser(user);
    return user;
  };
  const register = async (login, password) => {
    const { user } = await api.post('/auth/register', { login, password });
    setUser(user);
    return user;
  };
  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };
  const choosePlan = async (planId, confirm = false) => {
    const { user } = await api.post('/auth/plan', { planId, confirm });
    setUser(user);
    return user;
  };

  const value = { user, loading, login, register, logout, refresh, choosePlan, setUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
