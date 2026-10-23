import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatTime } from '../dates.js';
import CollapsibleNoteText from '../components/CollapsibleNoteText.jsx';
import { useAuth } from '../auth.jsx';

export default function OpenNotesPage() {
  const { translation } = useAuth();
  const [notes, setNotes] = useState(null);
  const [message, setMessage] = useState('');
  const [personal, setPersonal] = useState(true);
  const [publicNotes, setPublicNotes] = useState(true);

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
    let active = true;
    setMessage('');
    setNotes(null);
    if (!personal && !publicNotes) {
      setNotes([]);
      return () => { active = false; };
    }
    api.get(`/notes/feed?personal=${personal ? 1 : 0}&public=${publicNotes ? 1 : 0}`)
      .then((data) => { if (active) setNotes(data.notes); })
      .catch((e) => { if (active) { setMessage(e.message); setNotes([]); } });
    return () => { active = false; };
  }, [personal, publicNotes, translation]);

  return (
    <div className="container py-3 open-notes-page">
      <h1 className="h5 mb-3">Заметки</h1>
      <div className="notes-filters mb-3" role="group" aria-label="Видимость заметок">
        <label className="form-check form-switch mb-0">
          <input className="form-check-input" type="checkbox" role="switch" checked={personal} onChange={(e) => setPersonal(e.target.checked)} />
          <span>Личные</span>
        </label>
        <label className="form-check form-switch mb-0">
          <input className="form-check-input" type="checkbox" role="switch" checked={publicNotes} onChange={(e) => setPublicNotes(e.target.checked)} />
          <span>Публичные</span>
        </label>
      </div>
      {message && <div className="alert alert-info py-2">{message}</div>}

      {notes === null && <div className="text-muted" role="status">Загрузка…</div>}
      {notes?.map((n) => (
        <div key={n.id} className={`note-card ${n.visibility === 'personal' ? 'note-personal' : 'note-open'} mb-2`}>
          <div className="note-feed-meta">
            <span className="text-muted small">{n.author_login} · {n.visibility === 'personal' ? 'личная' : 'публичная'}</span>
            <span className="text-muted small">
              {formatTime(n.updated_at)}
            </span>
          </div>
          <details className="note-scripture">
            <summary>{n.book} {n.chapter}:{n.verse} · <span>Текст стиха</span></summary>
            <blockquote>{n.verseText || 'Текст стиха недоступен.'}</blockquote>
          </details>
          <CollapsibleNoteText text={n.text} className="mt-1" />
          {n.visibility === 'open' && <button
            type="button"
            className={`like-btn ${n.likedByMe ? 'liked' : ''}`}
            disabled={n.isMine}
            aria-pressed={n.likedByMe}
            aria-label={n.likedByMe ? `Снять лайк, ${n.likes}` : `Поставить лайк, ${n.likes}`}
            onClick={() => like(n)}
          >
            ♥ {n.likes}
          </button>}
        </div>
      ))}

      {notes?.length === 0 && !message && <div className="text-muted">{!personal && !publicNotes ? 'Включите личные или публичные заметки.' : 'Заметок пока нет.'}</div>}
    </div>
  );
}
