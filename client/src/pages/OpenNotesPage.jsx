import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatTime } from '../dates.js';

export default function OpenNotesPage() {
  const [notes, setNotes] = useState(null);
  const [message, setMessage] = useState('');

  const load = () => api.get('/notes/open').then((d) => setNotes(d.notes));

  useEffect(() => {
    load();
  }, []);

  if (!notes) return <div className="container py-4 text-muted">Загрузка…</div>;

  return (
    <div className="container py-3">
      <h1 className="h5 mb-1">Открытые заметки группы</h1>
      <p className="text-muted small">
        Это заметки, которые авторы сделали видимыми всем. Личные заметки здесь не показываются.
      </p>
      {message && <div className="alert alert-info py-2">{message}</div>}

      {notes.map((n) => (
        <div key={n.id} className="note-card note-open mb-2">
          <div className="d-flex justify-content-between">
            <span className="text-muted small">{n.author_login}</span>
            <span className="text-muted small">
              {n.book} {n.chapter}:{n.verse} · {formatTime(n.updated_at)}
            </span>
          </div>
          <div className="mt-1" style={{ whiteSpace: 'pre-wrap' }}>
            {n.text}
          </div>
          <div className="text-muted small mt-1">♥ {n.likes}</div>
        </div>
      ))}

      {!notes.length && <div className="text-muted">Открытых заметок пока нет.</div>}
    </div>
  );
}
