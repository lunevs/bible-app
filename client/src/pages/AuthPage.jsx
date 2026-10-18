import { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [fields, setFields] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(fields.login, fields.password);
      else await register(fields.login, fields.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="text-center mb-4">
          <div style={{ fontSize: '2.4rem' }}>✝️</div>
          <h1 className="h4 mt-2 mb-0">Чтение Евангелий</h1>
          <div className="text-muted small">до Рождества 2026</div>
        </div>

        <div className="card-soft p-4">
          <ul className="nav nav-pills nav-justified mb-3">
            <li className="nav-item">
              <button
                className={`nav-link ${mode === 'login' ? 'active btn-brand' : ''}`}
                onClick={() => setMode('login')}
                type="button"
              >
                Вход
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link ${mode === 'register' ? 'active btn-brand' : ''}`}
                onClick={() => setMode('register')}
                type="button"
              >
                Регистрация
              </button>
            </li>
          </ul>

          <form onSubmit={submit}>
            <div className="mb-3">
              <label className="form-label">Логин</label>
              <input
                className="form-control"
                value={fields.login}
                autoComplete="username"
                onChange={(e) => setFields({ ...fields, login: e.target.value })}
                required
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Пароль</label>
              <input
                type="password"
                className="form-control"
                value={fields.password}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                onChange={(e) => setFields({ ...fields, password: e.target.value })}
                required
              />
              <div className="form-text">Не короче 3 символов.</div>
            </div>

            {error && <div className="alert alert-danger py-2">{error}</div>}

            <button className="btn btn-brand w-100" disabled={busy} type="submit">
              {busy ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
