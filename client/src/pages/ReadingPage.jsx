import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { formatDate } from '../dates.js';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { useReadingTracker } from '../hooks/useReadingTracker.js';
import { copyText } from '../clipboard.js';
import CollapsibleNoteText from '../components/CollapsibleNoteText.jsx';

const BOOK_NAMES = {
  Мф: 'Евангелие от Матфея',
  Мк: 'Евангелие от Марка',
  Лк: 'Евангелие от Луки',
  Ин: 'Евангелие от Иоанна',
};

const verseRef = (v) => `${BOOK_NAMES[v.book] || v.book} ${v.chapter}:${v.verse}`;

export default function ReadingPage() {
  const { planId, date } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(null);

  const load = useCallback(
    () =>
      api
        .get(`/reading/${planId}/${date}`)
        .then((d) => {
          setEntry(d);
          setStatus(d.status);
        })
        .catch((e) => setError(e.message)),
    [planId, date]
  );

  useEffect(() => {
    setEntry(null);
    setError('');
    load();
  }, [load]);

  if (error) {
    return (
      <div className="container py-4">
        <div className="alert alert-warning">{error}</div>
        <button className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
          Назад
        </button>
      </div>
    );
  }
  if (!entry) return <div className="container py-4 text-muted">Загрузка…</div>;

  return <Reader entry={entry} status={status} setStatus={setStatus} onChanged={load} />;
}

function Reader({ entry, status, setStatus, onChanged }) {
  const navigate = useNavigate();
  const lastVerseRef = useRef(null);

  const [actionVerse, setActionVerse] = useState(null); // меню действий по стиху
  const [addVerse, setAddVerse] = useState(null); // окно «Добавить заметку»
  const [askVerse, setAskVerse] = useState(null); // окно «Задать вопрос»
  const [viewVerse, setViewVerse] = useState(null); // окно «Заметки»
  const [toast, setToast] = useState('');

  const { seconds, sessionSeconds, reachedEnd, markReachedEnd } = useReadingTracker({
    planId: entry.planId,
    date: entry.date,
    enabled: true,
    initialSeconds: entry.progress.seconds,
    onStatus: setStatus,
  });

  // Отслеживание «дошёл до конца отрывка».
  useEffect(() => {
    const el = lastVerseRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) markReachedEnd();
      },
      { threshold: 0.6 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [markReachedEnd, entry.date]);

  // Автоскрытие всплывающего уведомления.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const credited = status === 'green' || status === 'blue';
  const progressPct = Math.min(100, Math.round((seconds / entry.thresholdSeconds) * 100));
  const myNotes = entry.myNotes || {};

  const handleCopy = async (verse) => {
    const ok = await copyText(verse.text);
    setToast(ok ? 'Стих скопирован' : 'Не удалось скопировать');
    setActionVerse(null);
  };

  return (
    <div className="container py-3 reading-page">
      <div className="d-flex justify-content-between align-items-start mb-2">
        <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <StatusBadge status={status} size={26} />
      </div>

      <div className="text-muted small">{formatDate(entry.date)}</div>
      <h1 className="reading-title mt-1">{entry.label}</h1>
      {entry.special === 'christmas' && (
        <span className="badge text-bg-warning mb-2">Рождественский отрывок</span>
      )}

      <div className="reader-progress d-flex justify-content-between align-items-center" aria-live="polite">
        <span>
          {credited
            ? 'Отрывок прочитан'
            : reachedEnd
              ? 'Дошли до конца. Ещё немного активного чтения — и зачтётся.'
              : 'Читайте: время накапливается, пока экран активен.'}
        </span>
        <span className="reading-timer" aria-label={`Время чтения в этой сессии: ${sessionSeconds} секунд`}>{sessionSeconds} с</span>
      </div>
      <div className="progress mb-3" style={{ height: 6 }}>
        <div className="progress-bar"
          style={{ width: `${progressPct}%`, background: 'var(--brand)' }}
        />
      </div>

      {entry.thoughts && (
        <div className="thought-box mb-3">
          <div className="text-muted small mb-1">Ключевая мысль</div>
          {entry.thoughts}
        </div>
      )}

      <p className="text-muted small mb-2">
        Нажмите на стих, чтобы добавить заметку.
      </p>

      <div className="card-soft p-2 mb-4">
        {entry.verses.map((v) => {
          const isMain =
            entry.mainVerse &&
            v.book === entry.mainVerse.book &&
            v.chapter === entry.mainVerse.chapter &&
            v.verse === entry.mainVerse.verse;
          const isLast = v === entry.verses[entry.verses.length - 1];
          const mine = myNotes[`${v.book}:${v.chapter}:${v.verse}`];
          return (
            <div
              key={`${v.book}-${v.chapter}-${v.verse}`}
              className={`verse verse-tap ${isMain ? 'main-verse' : ''}`}
              ref={isLast ? lastVerseRef : null}
              role="button"
              tabIndex={0}
              onClick={() => setActionVerse(v)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActionVerse(v);
                }
              }}
            >
              <span className="vnum">{v.verse}</span>
              <span className="verse-text">
                {isMain && <span className="main-verse-tag">Главный стих</span>}
                {v.text}
              </span>
              {mine && (
                <button
                  type="button"
                  className="note-flag"
                  title={`Мои заметки к стиху (${mine.count})`}
                  aria-label="Мои заметки к стиху"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewVerse(v);
                  }}
                >
                  <img src="/note-icon.png" alt="заметка" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {actionVerse && (
        <ActionSheet
          verse={actionVerse}
          onClose={() => setActionVerse(null)}
          onAddNote={() => {
            setAddVerse(actionVerse);
            setActionVerse(null);
          }}
          onAskQuestion={() => {
            setAskVerse(actionVerse);
            setActionVerse(null);
          }}
          onCopy={() => handleCopy(actionVerse)}
        />
      )}

      {addVerse && (
        <AddNoteModal
          verse={addVerse}
          onClose={() => setAddVerse(null)}
          onAdded={() => {
            setAddVerse(null);
            setToast('Заметка добавлена');
            onChanged();
          }}
        />
      )}

      {askVerse && (
        <AskQuestionModal
          verse={askVerse}
          onClose={() => setAskVerse(null)}
          onCreated={() => {
            setAskVerse(null);
            setToast('Вопрос опубликован');
          }}
        />
      )}

      {viewVerse && (
        <ViewNotesModal
          verse={viewVerse}
          onClose={() => setViewVerse(null)}
          onChanged={onChanged}
        />
      )}

      {toast && <div className="app-toast">{toast}</div>}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="fw-semibold">{title}</div>
          <button className="btn-close" aria-label="Закрыть" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  );
}

function ActionSheet({ verse, onClose, onAddNote, onAskQuestion, onCopy }) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-preview">
          <div className="text-muted small">{verseRef(verse)}</div>
          <div className="sheet-verse-text">{verse.text}</div>
        </div>
        <button className="sheet-item" onClick={onAddNote}>
          📝 Добавить заметку
        </button>
        <button className="sheet-item" onClick={onAskQuestion}>
          ❔ Задать вопрос
        </button>
        <button className="sheet-item" onClick={onCopy}>
          📋 Копировать
        </button>
        <button className="sheet-item sheet-cancel" onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  );
}

// Окно добавления: ТОЛЬКО стих и форма новой заметки (без списка существующих).
function AddNoteModal({ verse, onClose, onAdded }) {
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState('personal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/notes', {
        book: verse.book,
        chapter: verse.chapter,
        verse: verse.verse,
        text,
        visibility,
      });
      onAdded?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Заметка" onClose={onClose}>
      <div className="modal-verse-text mb-3">{verse.text}</div>

      <textarea
        className="form-control mb-2"
        rows={6}
        maxLength={2000}
        autoFocus
        placeholder="Ваша заметка к этому стиху…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <div className="alert alert-danger py-1 small">{error}</div>}

      <div className="d-flex align-items-center gap-3">
        <label className="d-flex align-items-center gap-2 mb-0 me-auto">
          <input
            type="checkbox"
            className="form-check-input mt-0"
            checked={visibility === 'open'}
            onChange={(e) => setVisibility(e.target.checked ? 'open' : 'personal')}
          />
          <span>публичная</span>
        </label>
        <button className="btn btn-brand px-4" disabled={busy || !text.trim()} onClick={submit}>
          Добавить
        </button>
      </div>
    </Modal>
  );
}

function AskQuestionModal({ verse, onClose, onCreated }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/questions', {
        book: verse.book,
        chapter: verse.chapter,
        verse: verse.verse,
        text,
      });
      onCreated?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Задать вопрос" onClose={onClose}>
      <div className="modal-verse-text mb-3">
        <div className="small text-muted mb-1">{verseRef(verse)}</div>
        {verse.text}
      </div>
      <p className="text-muted small">Вопрос будет опубликован и доступен всем участникам.</p>
      <textarea
        className="form-control mb-2"
        rows={4}
        maxLength={2000}
        autoFocus
        placeholder="Что вы хотели бы обсудить?"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {error && <div className="alert alert-danger py-1 small">{error}</div>}
      <div className="d-flex justify-content-end gap-2">
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Отмена</button>
        <button type="button" className="btn btn-brand px-4" disabled={busy || !text.trim()} onClick={submit}>
          Опубликовать
        </button>
      </div>
    </Modal>
  );
}

// Окно просмотра: ТОЛЬКО стих и существующие заметки (без формы добавления).
function ViewNotesModal({ verse, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () =>
      api
        .get(`/notes?book=${verse.book}&chapter=${verse.chapter}&verse=${verse.verse}`)
        .then(setData)
        .catch((e) => setError(e.message)),
    [verse.book, verse.chapter, verse.verse]
  );

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const afterChange = async () => {
    await load();
    onChanged?.();
  };

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editVisibility, setEditVisibility] = useState('personal');
  const [confirmId, setConfirmId] = useState(null);

  const startEdit = (n) => {
    setEditingId(n.id);
    setEditText(n.text);
    setEditVisibility(n.visibility);
  };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = async (n) => {
    if (!editText.trim()) return;
    await api.patch(`/notes/${n.id}`, { text: editText, visibility: editVisibility });
    setEditingId(null);
    afterChange();
  };
  const remove = async (id) => {
    await api.del(`/notes/${id}`);
    afterChange();
  };
  const like = async (n) => {
    await api.post(`/notes/${n.id}/like`);
    load();
  };

  const own = data?.own || [];
  const open = data?.open || [];

  return (
    <Modal title="Заметки" onClose={onClose}>
      <div className="modal-verse-text mb-3">{verse.text}</div>

      {error && <div className="alert alert-danger py-1 small">{error}</div>}
      {!data && <div className="text-muted small">Загрузка…</div>}

      {own.map((n) => (
        <div key={n.id} className="note-card note-personal mb-2">
          {editingId === n.id ? (
            <>
              <textarea
                className="form-control mb-2"
                rows={6}
                maxLength={2000}
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
              />
              <div className="d-flex align-items-center gap-2">
                <label className="d-flex align-items-center gap-2 mb-0 me-auto">
                  <input
                    type="checkbox"
                    className="form-check-input mt-0"
                    checked={editVisibility === 'open'}
                    onChange={(e) => setEditVisibility(e.target.checked ? 'open' : 'personal')}
                  />
                  <span>публичная</span>
                </label>
                <button className="btn btn-outline-secondary btn-sm" onClick={cancelEdit}>
                  Отмена
                </button>
                <button
                  className="btn btn-brand btn-sm"
                  disabled={!editText.trim()}
                  onClick={() => saveEdit(n)}
                >
                  Сохранить
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="d-flex justify-content-between align-items-center">
                <span className="badge text-bg-light">
                  {n.visibility === 'open' ? 'опубликована' : 'личная'}
                </span>
                <div className="d-flex gap-1">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Редактировать"
                    aria-label="Редактировать заметку"
                    onClick={() => startEdit(n)}
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="Удалить"
                    aria-label="Удалить заметку"
                    onClick={() => setConfirmId(n.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <CollapsibleNoteText text={n.text} className="mt-1" />
              {n.likes > 0 && <div className="text-muted small mt-1">♥ {n.likes}</div>}
            </>
          )}
        </div>
      ))}

      {open.map((n) => (
        <div key={n.id} className="note-card note-open mb-2">
          <div className="text-muted small">{n.authorLogin}</div>
          <CollapsibleNoteText text={n.text} className="mt-1" />
          <button className={`like-btn ${n.likedByMe ? 'liked' : ''}`} onClick={() => like(n)}>
            ♥ {n.likes}
          </button>
        </div>
      ))}

      {data && !own.length && !open.length && (
        <div className="text-muted small">Заметок к этому стиху пока нет.</div>
      )}

      {confirmId != null && (
        <Modal title="Удалить заметку?" onClose={() => setConfirmId(null)}>
          <div className="mb-3">Заметка будет удалена. Это действие нельзя отменить.</div>
          <div className="d-flex gap-2">
            <button
              className="btn btn-danger flex-fill"
              onClick={() => {
                const id = confirmId;
                setConfirmId(null);
                remove(id);
              }}
            >
              Удалить
            </button>
            <button className="btn btn-outline-secondary" onClick={() => setConfirmId(null)}>
              Отмена
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
