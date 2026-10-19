import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatTime } from '../dates.js';
import CollapsibleNoteText from '../components/CollapsibleNoteText.jsx';

export default function OpenNotesPage() {
  const [notes, setNotes] = useState(null);
  const [message, setMessage] = useState('');

  const load = () => api.get('/notes/open').then((d) => setNotes(d.notes));

  const like = async (note) => {
    setMessage('');
    try {
      const result = await api.post(`/notes/${note.id}/like`);
      setNotes((current) => current?.map((item) => item.id === note.id
        ? { ...item, likes: result.likes, likedByMe: result.liked }
        : item));
    } catch (e) {
      setMessage(e.message);
    }
  };

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
          <CollapsibleNoteText text={n.text} className="mt-1" />
          <button
            type="button"
            className={`like-btn ${n.likedByMe ? 'liked' : ''}`}
            disabled={n.isMine}
            aria-pressed={n.likedByMe}
            aria-label={n.likedByMe ? `Снять лайк, ${n.likes}` : `Поставить лайк, ${n.likes}`}
            onClick={() => like(n)}
          >
            ♥ {n.likes}
          </button>
        </div>
      ))}

      {!notes.length && <div className="text-muted">Открытых заметок пока нет.</div>}
    </div>
  );
}
