import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Legend } from '../components/StatusBadge.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { formatDate } from '../dates.js';
import { useNavigate } from 'react-router-dom';

export default function ProgressPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!user?.planId) return;
    api.get(`/progress/${user.planId}`).then(setData);
  }, [user]);

  if (!user?.planId) {
    return (
      <div className="container py-4">
        <p className="text-muted">Сначала выберите план.</p>
      </div>
    );
  }

  const all = data?.days || [];

  const counts = all.reduce(
    (acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    },
    {}
  );

  return (
    <div className="container py-3">
      <h1 className="h5 mb-3">Прогресс</h1>
      {data && (
        <div className="card-soft progress-summary p-3 mb-3">
          <div className="progress-summary-heading">
            <span className="text-muted small">План «{data.planName}»</span>
            <strong>{(counts.green || 0) + (counts.blue || 0)} из {all.length} прочитано</strong>
          </div>
          <div className="progress summary-progress" role="img" aria-label={`${(counts.green || 0) + (counts.blue || 0)} из ${all.length} отрывков прочитано`}>
            <div className="progress-bar" style={{ width: `${all.length ? Math.round((((counts.green || 0) + (counts.blue || 0)) / all.length) * 100) : 0}%` }} />
          </div>
          <div className="progress-stats">
            <div><strong className="text-success">{counts.green || 0}</strong><span>вовремя</span></div>
            <div><strong className="text-late">{counts.blue || 0}</strong><span>позже</span></div>
            <div><strong className="text-danger">{counts.missed || 0}</strong><span>пропущено</span></div>
          </div>
        </div>
      )}

      <details className="status-legend mb-3">
        <summary>Что означают отметки?</summary>
        <Legend />
      </details>

      {all.map((d) => (
        <button
          key={d.date}
          className="day-row w-100 border-0 text-start"
          onClick={() => navigate(`/read/${user.planId}/${d.date}`)}
        >
          <StatusBadge status={d.status} />
          <div>
            <div className="label">{d.label}</div>
            <div className="date">{formatDate(d.date)}</div>
          </div>
          {d.points > 0 && <span className="ms-auto text-muted small">{d.points}</span>}
        </button>
      ))}
    </div>
  );
}
