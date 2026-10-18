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
      <p className="text-muted small">
        Чтение: зелёная галочка — 1 балл, синяя — 0,5. Лайк на вашу заметку — +0,1 балла.
        Видна всем участникам.
      </p>

      {rows.map((r, i) => (
        <div key={r.id} className="leader-row">
          <div className="leader-rank">{i + 1}</div>
          <div>
            <div className="fw-semibold">
              {r.login} {r.role === 'admin' && <span className="badge text-bg-secondary ms-1">админ</span>}
            </div>
            <div className="text-muted small">
              🟢 {r.green} · 🔵 {r.blue} из {r.total} · ♥ {r.likes}
            </div>
            {(r.likePoints > 0 || r.readingPoints > 0) && (
              <div className="text-muted small">
                чтение {r.readingPoints} + лайки {r.likePoints}
              </div>
            )}
          </div>
          <div className="leader-points">{r.points} б.</div>
        </div>
      ))}

      {!rows.length && <div className="text-muted">Пока нет участников.</div>}
    </div>
  );
}
