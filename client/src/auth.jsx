import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setApiTranslation } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [translation, setTranslation] = useState('synodal');
  const [translations, setTranslations] = useState([]);

  const acceptSession = useCallback((result) => {
    const available = result.translations || [];
    let saved = 'synodal';
    try { saved = localStorage.getItem(`bible-translation:${result.user?.id}`) || 'synodal'; } catch { /* Хранилище может быть отключено. */ }
    const choice = available.some((t) => t.id === saved) ? saved : 'synodal';
    setApiTranslation(choice);
    setTranslation(choice);
    setTranslations(available);
    setUser(result.user);
    return result.user;
  }, []);

  const refresh = useCallback(async () => {
    try {
      return acceptSession(await api.get('/auth/me'));
    } catch {
      setUser(null);
      return null;
    }
  }, [acceptSession]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = async (login, password) => {
    return acceptSession(await api.post('/auth/login', { login, password }));
  };
  const register = async (login, password) => {
    return acceptSession(await api.post('/auth/register', { login, password }));
  };
  const logout = async () => {
    await api.post('/auth/logout');
    setApiTranslation('synodal');
    setUser(null);
  };
  const choosePlan = async (planId, confirm = false) => {
    const { user } = await api.post('/auth/plan', { planId, confirm });
    setUser(user);
    return user;
  };

  const chooseTranslation = (choice) => {
    if (!translations.some((t) => t.id === choice)) return;
    try { localStorage.setItem(`bible-translation:${user.id}`, choice); } catch { /* Выбор действует до закрытия приложения. */ }
    setApiTranslation(choice);
    setTranslation(choice);
  };

  const value = { user, loading, login, register, logout, refresh, choosePlan, setUser, translation, translations, chooseTranslation };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
