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
    api.get(`/reading/today/${user.planId}`).then(setData);
  }, [user]);

  if (!user?.planId) {
    return (
      <div className="container py-4">
        <p className="text-muted">Сначала выберите план.</p>
      </div>
    );
  }

  const all = data ? [...data.past, ...(data.today ? [data.today] : []), ...data.upcoming] : [];
  all.sort((a, b) => (a.date < b.date ? -1 : 1));

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
      <Legend />

      {data && (
        <div className="card-soft p-3 mb-3">
          <div className="d-flex justify-content-around text-center">
            <div>
              <div className="h5 mb-0 text-success">{counts.green || 0}</div>
              <div className="text-muted small">вовремя</div>
            </div>
            <div>
              <div className="h5 mb-0" style={{ color: 'var(--late)' }}>
                {counts.blue || 0}
              </div>
              <div className="text-muted small">позже</div>
            </div>
            <div>
              <div className="h5 mb-0 text-danger">{counts.missed || 0}</div>
              <div className="text-muted small">пропущено</div>
            </div>
            <div>
              <div className="h5 mb-0">{data.planName}</div>
              <div className="text-muted small">план</div>
            </div>
          </div>
        </div>
      )}

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
          {d.points > 0 && <span className="ms-auto text-muted small">{d.points} б.</span>}
        </button>
      ))}
    </div>
  );
}
