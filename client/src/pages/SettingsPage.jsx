import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { formatDate } from '../dates.js';
import { api } from '../api.js';
import { currentVersion, releases } from '../releases.js';

export default function SettingsPage() {
  const { user, logout, translation, translations, chooseTranslation } = useAuth();
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordFormOpen, setPasswordFormOpen] = useState(false);
  const [releasesOpen, setReleasesOpen] = useState(false);
  const [translationMessage, setTranslationMessage] = useState('');

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

      <div className="card-soft p-3 mb-3" role="group" aria-labelledby="bible-translation-heading">
        <h2 id="bible-translation-heading" className="h6 mb-2">Перевод Библии</h2>
        {translations.map((t) => (
          <label key={t.id} className={`translation-option ${translation === t.id ? 'is-selected' : ''}`}>
            <input type="radio" name="bible-translation" value={t.id} checked={translation === t.id} onChange={() => {
              chooseTranslation(t.id);
              setTranslationMessage(`Выбран перевод: ${t.name}`);
            }} />
            <span className="translation-indicator" aria-hidden="true">{translation === t.id ? '✓' : ''}</span>
            <span className="translation-name">{t.name}</span>
          </label>
        ))}
        <div className="translation-confirmation" role="status" aria-live="polite">{translationMessage}</div>
      </div>

      <div className="d-grid gap-2">
        <Link className="btn btn-outline-secondary" to="/plans">
          План чтения
        </Link>
        <button
          type="button"
          className="btn btn-outline-secondary w-100"
          aria-expanded={passwordFormOpen}
          aria-controls="change-password-form"
          onClick={() => {
            setPasswordFormOpen((open) => !open);
            setError('');
            setMessage('');
          }}
        >
          <span>Сменить пароль</span>
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
        <button
          type="button"
          className="btn btn-outline-secondary"
          aria-expanded={releasesOpen}
          aria-controls="release-notes"
          onClick={() => setReleasesOpen((open) => !open)}
        >
          Что нового · {currentVersion}
        </button>
        {releasesOpen && (
          <section id="release-notes" className="card-soft p-3" aria-label="История обновлений">
            <h2 className="h6 mb-3">История обновлений</h2>
            {releases.map((release, index) => (
              <article key={release.version} className={index ? 'border-top pt-3 mt-3' : ''}>
                <h3 className="h6 mb-1">
                  {release.version}{index === 0 && <span className="badge text-bg-light ms-2">Текущая</span>}
                </h3>
                <time className="text-muted small" dateTime={release.date}>{formatDate(release.date)}</time>
                <ul className="small mt-2 mb-0 ps-3">
                  {release.changes.map((change) => <li key={change}>{change}</li>)}
                </ul>
              </article>
            ))}
          </section>
        )}
        <button className="btn btn-outline-danger" onClick={logout}>
          Выйти
        </button>
      </div>

      <p className="text-muted small mt-4">
        Версия {currentVersion}.{' '}
        Приложение для совместного чтения Евангелий. Текст — Синодальный перевод (1876),
        общественное достояние.
      </p>
    </div>
  );
}
