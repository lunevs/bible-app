import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { formatDate } from '../dates.js';

export default function HomePage() {
  const { user } = useAuth();

  if (!user) return null;

  if (!user.planId) {
    return (
      <div className="container py-4">
        <h1 className="h4">Здравствуйте, {user.login}!</h1>
        <p className="text-muted">Вы ещё не выбрали план чтения.</p>
        <Link className="btn btn-brand" to="/plans">
          Выбрать план
        </Link>
      </div>
    );
  }

  return <PlanHome />;
}

function PlanHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let mounted = true;
    api
      .get(`/reading/today/${user.planId}`)
      .then((d) => mounted && setData(d))
      .catch((e) => setErr(e.message));
    return () => {
      mounted = false;
    };
  }, [user.planId]);

  const open = (entry) => navigate(`/read/${user.planId}/${entry.date}`);

  if (err) {
    return (
      <div className="container py-4">
        <div className="alert alert-warning">{err}</div>
      </div>
    );
  }
  if (!data) return <div className="container py-4 text-muted">Загрузка…</div>;

  const Row = ({ d }) => (
    <button className="day-row w-100 border-0 text-start" onClick={() => open(d)}>
      <StatusBadge status={d.status} />
      <div>
        <div className="label">{d.label}</div>
        <div className="date">{formatDate(d.date)}</div>
      </div>
    </button>
  );

  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="text-muted small">План · {user.login}</div>
          <div className="fw-semibold">{data.planName}</div>
        </div>
        <Link to="/plans" className="btn btn-sm btn-outline-secondary">
          Сменить план
        </Link>
      </div>

      {data.today ? (
        <div
          className="card-soft p-3 mb-3 tap-card"
          role="button"
          tabIndex={0}
          onClick={() => open(data.today)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              open(data.today);
            }
          }}
        >
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <div className="text-muted small">Сегодня · {formatDate(data.today.date)}</div>
              <div className="h5 mt-1 mb-0">{data.today.label}</div>
            </div>
            <StatusBadge status={data.today.status} size={26} />
          </div>
        </div>
      ) : (
        <div className="alert alert-info">
          На сегодня записей в плане нет. Ближайшая — ниже.
        </div>
      )}

      {data.nextUnread && (
        <div
          className="card-soft p-3 mb-3 tap-card"
          role="button"
          tabIndex={0}
          onClick={() => open(data.nextUnread)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              open(data.nextUnread);
            }
          }}
        >
          <div className="text-muted small">
            Следующий отрывок · {formatDate(data.nextUnread.date)}
          </div>
          <div className="d-flex justify-content-between align-items-start mt-1">
            <div className="h5 mb-0">{data.nextUnread.label}</div>
            <StatusBadge status={data.nextUnread.status} size={24} />
          </div>
        </div>
      )}

      {data.past?.length > 0 && (
        <>
          <div className="text-muted small mt-3 mb-2">Ранее — свежие сверху</div>
          {[...data.past].reverse().slice(0, 10).map((d) => (
            <Row key={d.date} d={d} />
          ))}
        </>
      )}
    </div>
  );
}
