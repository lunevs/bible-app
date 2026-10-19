import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { formatTime } from '../dates.js';

const bookNames = {
  Мф: 'Мф',
  Мк: 'Мк',
  Лк: 'Лк',
  Ин: 'Ин',
};

export default function QuestionsPage() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState({});
  const [answers, setAnswers] = useState({});
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingAnswer, setEditingAnswer] = useState(null);

  const load = useCallback(async () => {
    try {
      const result = await api.get('/questions');
      setQuestions(result.questions);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleAnswers = async (question) => {
    const willOpen = !expanded[question.id];
    setExpanded((current) => ({ ...current, [question.id]: willOpen }));
    if (willOpen && !answers[question.id]) {
      try {
        const result = await api.get(`/questions/${question.id}/answers`);
        setAnswers((current) => ({ ...current, [question.id]: result.answers }));
      } catch (e) {
        setError(e.message);
      }
    }
  };

  const submitAnswer = async (question) => {
    const text = answerDrafts[question.id]?.trim();
    if (!text) return;
    try {
      const result = await api.post(`/questions/${question.id}/answers`, { text });
      setAnswers((current) => ({
        ...current,
        [question.id]: [...(current[question.id] || []), {
          id: result.id,
          questionId: question.id,
          text,
          likes: 0,
          likedByMe: false,
          authorId: user.id,
          authorLogin: user.login,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          isMine: true,
        }],
      }));
      setQuestions((current) => current.map((q) => q.id === question.id ? { ...q, answerCount: q.answerCount + 1 } : q));
      setAnswerDrafts((current) => ({ ...current, [question.id]: '' }));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleAnswerLike = async (answer) => {
    try {
      const result = await api.post(`/question-answers/${answer.id}/like`);
      setAnswers((current) => ({
        ...current,
        [answer.questionId]: current[answer.questionId].map((item) => item.id === answer.id
          ? { ...item, likes: result.likes, likedByMe: result.liked }
          : item),
      }));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  const saveQuestion = async (question) => {
    const text = editingQuestion?.text?.trim();
    if (!text) return;
    try {
      await api.patch(`/questions/${question.id}`, { text });
      setQuestions((current) => current.map((q) => q.id === question.id ? { ...q, text, updatedAt: Date.now() } : q));
      setEditingQuestion(null);
      setError('');
    } catch (e) { setError(e.message); }
  };

  const saveAnswer = async (answer) => {
    const text = editingAnswer?.text?.trim();
    if (!text) return;
    try {
      await api.patch(`/question-answers/${answer.id}`, { text });
      setAnswers((current) => ({
        ...current,
        [answer.questionId]: current[answer.questionId].map((a) => a.id === answer.id ? { ...a, text, updatedAt: Date.now() } : a),
      }));
      setEditingAnswer(null);
      setError('');
    } catch (e) { setError(e.message); }
  };

  const removeQuestion = async (question) => {
    if (!window.confirm('Удалить вопрос вместе со всеми ответами?')) return;
    try {
      await api.del(`/questions/${question.id}`);
      setQuestions((current) => current.filter((q) => q.id !== question.id));
      setError('');
    } catch (e) { setError(e.message); }
  };

  const removeAnswer = async (answer) => {
    if (!window.confirm('Удалить ответ?')) return;
    try {
      await api.del(`/question-answers/${answer.id}`);
      setAnswers((current) => ({
        ...current,
        [answer.questionId]: current[answer.questionId].filter((a) => a.id !== answer.id),
      }));
      setQuestions((current) => current.map((q) => q.id === answer.questionId ? { ...q, answerCount: Math.max(0, q.answerCount - 1) } : q));
      setError('');
    } catch (e) { setError(e.message); }
  };

  if (!questions) return <div className="container py-4 text-muted">Загрузка вопросов…</div>;

  return (
    <div className="container py-3 questions-page">
      <h1 className="h5 mb-1">Вопросы</h1>
      <p className="text-muted small mb-3">Вопросы к стихам и мысли участников группы.</p>
      {error && <div className="alert alert-danger py-2">{error}</div>}

      {questions.map((question) => (
        <article className="question-card mb-2" key={question.id}>
          <div className="question-meta">
            <strong>{question.authorLogin}</strong>
            <span>{bookNames[question.book] || question.book} {question.chapter}:{question.verse}</span>
            <time>{formatTime(question.createdAt)}</time>
          </div>
          <div className="question-verse">{question.verseText}</div>

          {editingQuestion?.id === question.id ? (
            <div className="mt-2">
              <textarea className="form-control" rows={3} maxLength={2000} value={editingQuestion.text} onChange={(e) => setEditingQuestion({ ...editingQuestion, text: e.target.value })} />
              <div className="question-edit-actions">
                <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingQuestion(null)}>Отмена</button>
                <button className="btn btn-sm btn-brand" disabled={!editingQuestion.text.trim()} onClick={() => saveQuestion(question)}>Сохранить</button>
              </div>
            </div>
          ) : (
            <p className="question-text">{question.text}</p>
          )}

          <div className="question-actions">
            <button type="button" className="answers-toggle" aria-expanded={!!expanded[question.id]} onClick={() => toggleAnswers(question)}>
              {expanded[question.id] ? 'Скрыть ответы' : `Ответы · ${question.answerCount}`}
              <span aria-hidden="true">{expanded[question.id] ? '↑' : '↓'}</span>
            </button>
            {(question.isMine || user.role === 'admin') && editingQuestion?.id !== question.id && (
              <div className="question-owner-actions">
                {question.isMine && <button type="button" onClick={() => setEditingQuestion({ id: question.id, text: question.text })}>Изменить</button>}
                <button type="button" className="question-delete" onClick={() => removeQuestion(question)}>Удалить</button>
              </div>
            )}
          </div>

          {expanded[question.id] && (
            <div className="answers-panel">
              {!answers[question.id] ? <div className="text-muted small">Загрузка ответов…</div> : (
                <>
                  {answers[question.id].map((answer) => (
                    <div className="answer-item" key={answer.id}>
                      <div className="answer-meta"><strong>{answer.authorLogin}</strong><time>{formatTime(answer.createdAt)}</time></div>
                      {editingAnswer?.id === answer.id ? (
                        <>
                          <textarea className="form-control mt-1" rows={2} maxLength={2000} value={editingAnswer.text} onChange={(e) => setEditingAnswer({ ...editingAnswer, text: e.target.value })} />
                          <div className="question-edit-actions">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingAnswer(null)}>Отмена</button>
                            <button className="btn btn-sm btn-brand" disabled={!editingAnswer.text.trim()} onClick={() => saveAnswer(answer)}>Сохранить</button>
                          </div>
                        </>
                      ) : (
                        <div className="answer-body">
                          <p>{answer.text}</p>
                          <div className="answer-actions">
                            <button
                              type="button"
                              className={`like-btn answer-like ${answer.likedByMe ? 'liked' : ''}`}
                              disabled={answer.isMine}
                              aria-pressed={answer.likedByMe}
                              aria-label={answer.likedByMe ? `Снять лайк, ${answer.likes}` : `Поставить лайк, ${answer.likes}`}
                              onClick={() => toggleAnswerLike(answer)}
                            >
                              ♥ {answer.likes}
                            </button>
                            {(answer.isMine || user.role === 'admin') && (
                              <div className="question-owner-actions">
                                {answer.isMine && <button type="button" onClick={() => setEditingAnswer({ id: answer.id, text: answer.text })}>Изменить</button>}
                                <button type="button" className="question-delete" onClick={() => removeAnswer(answer)}>Удалить</button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {!answers[question.id].length && <div className="text-muted small mb-2">Ответов пока нет.</div>}
                </>
              )}
              <div className="answer-compose">
                <textarea className="form-control" rows={2} maxLength={2000} placeholder="Поделитесь своей мыслью…" value={answerDrafts[question.id] || ''} onChange={(e) => setAnswerDrafts((current) => ({ ...current, [question.id]: e.target.value }))} />
                <button type="button" className="btn btn-sm btn-brand" disabled={!answerDrafts[question.id]?.trim()} onClick={() => submitAnswer(question)}>Ответить</button>
              </div>
            </div>
          )}
        </article>
      ))}

      {!questions.length && <div className="empty-questions">Пока вопросов нет. Нажмите на стих во время чтения, чтобы задать первый.</div>}
    </div>
  );
}