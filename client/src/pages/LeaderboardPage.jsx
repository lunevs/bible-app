import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { rankBadge, personalRankStatus } from '../leaderboard.js';
import { useAuth } from '../auth.jsx';

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [dailyStatus, setDailyStatus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let timeout;
    let sequence = 0;
    const load = async () => {
      const requestId = ++sequence;
      clearTimeout(timeout);
      try {
        const data = await api.get('/leaderboard');
        if (!active || requestId !== sequence) return;
        setRows(data.leaderboard);
        setDailyStatus(data.dailyStatus);
        setError('');
        timeout = setTimeout(load, data.statusRefreshInMs || 60000);
      } catch (e) {
        if (!active || requestId !== sequence) return;
        setError(e.message);
        timeout = setTimeout(load, 30000);
      }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    load();
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; clearTimeout(timeout); document.removeEventListener('visibilitychange', onVisible); };
  }, [user.id]);

  if (!rows) return <div className="container py-4 text-muted" role="status">{error || 'Загрузка…'}</div>;

  const myIndex = rows.findIndex((r) => r.id === user.id);
  const personalStatus = myIndex >= 0 && dailyStatus ? personalRankStatus(myIndex, rows.length, dailyStatus.choice) : null;

  return (
    <div className="container py-3">
      <h1 className="h5 mb-3">Доска лидеров</h1>
      {error && <div className="alert alert-warning py-2" role="alert">{error}</div>}
      {personalStatus && (
        <section className="leader-personal-status mb-3" aria-label="Ваш статус" aria-live="polite">
          <span className="leader-status-emoji" aria-hidden="true">{personalStatus.emoji}</span>
          <p>{personalStatus.text}</p>
        </section>
      )}
      <div className="leaderboard-rules">
        <span>Чтение в срок — <strong>5 баллов</strong></span>
        <span>С опозданием — <strong>4 балла</strong></span>
        <span>Лайк, заметка — <strong>1 балл</strong></span>
      </div>

      <div className="leaderboard-columns" aria-hidden="true">
        <span />
        <span>Участник</span>
        <span>Баллы</span>
      </div>

      {rows.map((r, i) => {
        const badge = rankBadge(i, rows.length);
        return (
        <div key={r.id} className="leader-row">
          {r.id === user.id ? (
            <div className="leader-rank leader-emoji" role="img" aria-label={`Группа рейтинга ${badge.quantile} из 12`} title={`Группа рейтинга ${badge.quantile} из 12`}>{badge.emoji}</div>
          ) : (
            <div className="leader-rank">{i + 1}</div>
          )}
          <div className="leader-member">
            <div className="leader-name fw-semibold">
              <span className="leader-login" title={r.login}>{r.login}</span>
              {r.role === 'admin' && <span className="leader-admin badge text-bg-secondary">админ</span>}
            </div>
            <div className="leader-details">
              <span><i className="leader-dot on-time" aria-hidden="true" />В срок {r.green}</span>
              <span><i className="leader-dot late" aria-hidden="true" />Позже {r.blue}</span>
              <span>♥ {r.likes}</span>
              <span title="Баллы за заметки" aria-label={`Баллы за заметки: ${r.notePoints}`}>
                <svg className="leader-note-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 3h9l4 4v14H6z" />
                  <path d="M14 3v5h5M9 12h7M9 16h7" />
                </svg>
                {r.notePoints}
              </span>
            </div>
          </div>
          <div className="leader-points">{r.points}</div>
        </div>
        );
      })}

      {!rows.length && <div className="text-muted">Пока нет участников.</div>}
    </div>
  );
}
