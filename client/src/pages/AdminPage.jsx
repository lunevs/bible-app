import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { formatDate, formatTime } from '../dates.js';

function pointsLabel(points) {
  const lastTwo = points % 100;
  const last = points % 10;
  const word = lastTwo >= 11 && lastTwo <= 14 ? 'баллов' : last === 1 ? 'балл' : last >= 2 && last <= 4 ? 'балла' : 'баллов';
  return `${points} ${word}`;
}

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [detail, setDetail] = useState(null);

  const load = () => api.get('/admin/users').then((d) => setUsers(d.users));

  useEffect(() => {
    load();
  }, []);

  const resetPassword = async (u) => {
    const password = window.prompt(`Новый пароль для «${u.login}» (не короче 3 символов):`);
    if (!password) return;
    try {
      await api.post(`/admin/users/${u.id}/reset-password`, { password });
      setMessage(`Пароль пользователя «${u.login}» сброшен.`);
    } catch (e) {
      setMessage(e.message);
    }
  };

  const viewProgress = async (u) => {
    if (!u.planId) {
      setMessage(`«${u.login}» ещё не выбрал план.`);
      return;
    }
    const d = await api.get(`/admin/users/${u.id}/progress`);
    setDetail({ user: u, days: d.days });
  };

  return (
    <div className="container py-3">
      <h1 className="h5 mb-3">Панель администратора</h1>
      {message && <div className="alert alert-info py-2">{message}</div>}

      {users.map((u) => (
        <div key={u.id} className="card-soft admin-user-card p-3 mb-2">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <div className="fw-semibold">
                {u.login} {u.role === 'admin' && <span className="badge text-bg-secondary">админ</span>}
              </div>
              <div className="text-muted small">
                {u.planId ? `план: ${u.planId}` : 'план не выбран'}
                {` · ${pointsLabel(u.summary.points)}`}
              </div>
            </div>
            <div className="d-flex gap-1 admin-user-actions">
              <button className="btn btn-sm btn-outline-secondary" onClick={() => viewProgress(u)}>
                Прогресс
              </button>
              <button className="btn btn-sm btn-outline-primary" onClick={() => resetPassword(u)}>
                Сбросить пароль
              </button>
            </div>
          </div>
        </div>
      ))}

      {detail && (
        <div className="card-soft p-3 mt-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="fw-semibold">Прогресс: {detail.user.login}</div>
            <button className="btn btn-sm btn-outline-secondary" onClick={() => setDetail(null)}>
              Закрыть
            </button>
          </div>
          {detail.days.map((d) => (
            <div key={d.date} className="day-row" style={{ padding: '6px 8px' }}>
              <StatusBadge status={d.status} size={18} />
              <div className="date">{formatDate(d.date)}</div>
              {d.readAt && <span className="ms-auto text-muted small">зачтено {formatTime(d.readAt)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
