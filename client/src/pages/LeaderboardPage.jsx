import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function LeaderboardPage() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api.get('/leaderboard').then((d) => setRows(d.leaderboard));
  }, []);

  if (!rows) return <div className="container py-4 text-muted">Загрузка…</div>;

  return (
    <div className="container py-3">
      <h1 className="h5 mb-3">Доска лидеров</h1>
      <div className="leaderboard-rules">
        <span>Чтение в срок — <strong>5 баллов</strong></span>
        <span>С опозданием — <strong>4 балла</strong></span>
        <span>Каждый полученный лайк — <strong>1 балл</strong></span>
      </div>

      <div className="leaderboard-columns" aria-hidden="true">
        <span />
        <span>Участник</span>
        <span>Баллы</span>
      </div>

      {rows.map((r, i) => (
        <div key={r.id} className="leader-row">
          <div className="leader-rank">{i + 1}</div>
          <div className="leader-member">
            <div className="leader-name fw-semibold">
              <span className="leader-login" title={r.login}>{r.login}</span>
              {r.role === 'admin' && <span className="leader-admin badge text-bg-secondary">админ</span>}
            </div>
            <div className="leader-details">
              <span><i className="leader-dot on-time" aria-hidden="true" />В срок {r.green}</span>
              <span><i className="leader-dot late" aria-hidden="true" />Позже {r.blue}</span>
              <span>♥ {r.likes}</span>
            </div>
          </div>
          <div className="leader-points">{r.points}</div>
        </div>
      ))}

      {!rows.length && <div className="text-muted">Пока нет участников.</div>}
    </div>
  );
}
