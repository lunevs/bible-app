import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { formatTime } from '../dates.js';

// Текст заметки: по умолчанию свёрнут до 4 строк. Если текст длиннее, в конце 4-й строки
// показывается «ещё» (без переноса на новую строку); в развёрнутом виде — «свернуть».
function CollapsibleText({ text }) {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    if (expanded) return; // при развёрнутом не пересчитываем, чтобы кнопка не пропадала
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflow(el.scrollHeight - el.clientHeight > 1);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [text, expanded]);

  return (
    <div className="note-wrap mt-1">
      <div ref={ref} className={`note-text ${expanded ? '' : 'clamp-lines'}`}>
        {text}
      </div>
      {expanded ? (
        <button type="button" className="clamp-toggle" onClick={() => setExpanded(false)}>
          свернуть
        </button>
      ) : overflow ? (
        <button type="button" className="clamp-toggle clamp-more" onClick={() => setExpanded(true)}>
          ещё
        </button>
      ) : null}
    </div>
  );
}

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
          <CollapsibleText text={n.text} />
          <div className="text-muted small mt-1">♥ {n.likes}</div>
        </div>
      ))}

      {!notes.length && <div className="text-muted">Открытых заметок пока нет.</div>}
    </div>
  );
}
