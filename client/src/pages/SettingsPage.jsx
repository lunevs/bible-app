import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { formatDate } from '../dates.js';
import { api } from '../api.js';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');
    if (password !== passwordRepeat) {
      setError('Пароли не совпадают. Проверьте оба поля.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/auth/change-password', { password, passwordRepeat });
      setPassword('');
      setPasswordRepeat('');
      setMessage('Пароль успешно изменён.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container py-3">
      <h1 className="h5 mb-3">Настройки приложения</h1>

      <div className="card-soft p-3 mb-3">
        <div className="d-flex justify-content-between">
          <span className="text-muted">Пользователь</span>
          <span className="fw-semibold">{user.login}</span>
        </div>
        <div className="d-flex justify-content-between mt-2">
          <span className="text-muted">Роль</span>
          <span>{user.role === 'admin' ? 'администратор' : 'пользователь'}</span>
        </div>
        <div className="d-flex justify-content-between mt-2">
          <span className="text-muted">Начало участия в плане</span>
          <span>{user.planStartedAt ? formatDate(user.planStartedAt) : '—'}</span>
        </div>
      </div>

      <div className="d-grid gap-2">
        <Link className="btn btn-outline-secondary" to="/plans">
          План чтения
        </Link>
        <button
          type="button"
          className="settings-action card-soft"
          aria-expanded={passwordFormOpen}
          aria-controls="change-password-form"
          onClick={() => {
            setPasswordFormOpen((open) => !open);
            setError('');
            setMessage('');
          }}
        >
          <span>Сменить пароль</span>
          <span className="settings-action-arrow" aria-hidden="true">{passwordFormOpen ? '−' : '+'}</span>
        </button>
        {passwordFormOpen && (
          <form id="change-password-form" className="card-soft p-3" onSubmit={changePassword}>
            <label className="form-label" htmlFor="new-password">Новый пароль</label>
            <input
              id="new-password"
              className="form-control mb-3"
              type="password"
              autoComplete="new-password"
              minLength={3}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label className="form-label" htmlFor="repeat-password">Повторите новый пароль</label>
            <input
              id="repeat-password"
              className="form-control mb-3"
              type="password"
              autoComplete="new-password"
              minLength={3}
              required
              value={passwordRepeat}
              onChange={(e) => setPasswordRepeat(e.target.value)}
            />
            {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
            {message && <div className="alert alert-success py-2" role="status">{message}</div>}
            <button className="btn btn-brand w-100" type="submit" disabled={busy || !password || !passwordRepeat}>
              {busy ? 'Сохраняем…' : 'Сохранить новый пароль'}
            </button>
            <div className="form-text mt-2">Старый пароль вводить не нужно. Минимальная длина — 3 символа.</div>
          </form>
        )}
        {user.role === 'admin' && (
          <Link className="btn btn-outline-secondary" to="/admin">
            Панель администратора
          </Link>
        )}
        <button className="btn btn-outline-danger" onClick={logout}>
          Выйти
        </button>
      </div>

      <p className="text-muted small mt-4">
        Приложение для совместного чтения Евангелий. Текст — Синодальный перевод (1876),
        общественное достояние.
      </p>
    </div>
  );
}
