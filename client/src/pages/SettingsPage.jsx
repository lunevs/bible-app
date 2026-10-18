import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { formatDate } from '../dates.js';

export default function SettingsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="container py-3">
      <h1 className="h5 mb-3">Ещё</h1>

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
        <Link className="btn btn-outline-secondary" to="/notes">
          Открытые заметки группы
        </Link>
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
