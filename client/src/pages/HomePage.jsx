import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { formatDate } from '../dates.js';
import PlanSelectPage from './PlanSelectPage.jsx';

export default function HomePage() {
  const { user } = useAuth();

  if (!user) return null;

  // Новый пользователь: сразу показываем планы на вкладке «Чтение», без промежуточной кнопки.
  if (!user.planId) return <PlanSelectPage />;

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
      <div className="fw-semibold mb-3">
        {user.login}. План чтения: {data.planName}
      </div>

      {!data.today && (
        <div className="alert alert-info">На сегодня записей в плане нет.</div>
      )}

      {data.today && !data.todayRead && (
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

      {data.readDays?.length > 0 && (
        <>
          <div className="text-muted small mt-3 mb-2">прочитанные отрывки</div>
          {data.readDays.map((d) => (
            <Row key={d.date} d={d} />
          ))}
        </>
      )}
    </div>
  );
}
