import { useEffect, useState } from 'react';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { Legend } from '../components/StatusBadge.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { formatDate } from '../dates.js';
import { useNavigate } from 'react-router-dom';
import PlanSelectPage from './PlanSelectPage.jsx';

export default function ProgressPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [homeData, setHomeData] = useState(null);

  useEffect(() => {
    if (!user?.planId) return;
    api.get(`/progress/${user.planId}`).then(setData);
    api.get(`/reading/today/${user.planId}`).then(setHomeData);
  }, [user]);

  if (!user?.planId) {
    return <PlanSelectPage />;
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
      <div className="home-heading mb-3">
        <div className="home-greeting">План чтения</div>
        <h1 className="h5 mb-0">{user.login}. План чтения: {data?.planName || '…'}</h1>
      </div>
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

      {homeData?.today && !homeData.todayRead && (
        <button
          type="button"
          className="card-soft today-reading-card w-100 text-start p-3 mb-3"
          onClick={() => navigate(`/read/${user.planId}/${homeData.today.date}`)}
        >
          <span className="text-muted small">Чтение на сегодня · {formatDate(homeData.today.date)}</span>
          <span className="d-flex justify-content-between align-items-center gap-2 mt-1">
            <strong>{homeData.today.label}</strong>
            <StatusBadge status={homeData.today.status} size={24} />
          </span>
          <span className="reading-card-action">Открыть чтение <span aria-hidden="true">→</span></span>
        </button>
      )}

      {homeData?.today && homeData.todayRead && (
        <div className="today-reading-done mb-3">
          <StatusBadge status={homeData.today.status} size={22} />
          <span>Отрывок на сегодня прочитан</span>
          <button
            type="button"
            className="today-open-link"
            onClick={() => navigate(`/read/${user.planId}/${homeData.today.date}`)}
          >
            Открыть
          </button>
        </div>
      )}

      {homeData && !homeData.today && (
        <div className="alert alert-info">На сегодня записей в плане нет.</div>
      )}

      <details className="status-legend mb-3">
        <summary>Что означают отметки?</summary>
        <Legend />
      </details>

      <h2 className="home-section-title plan-list-title">Весь план</h2>
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
