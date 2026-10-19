import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';

export default function PlanSelectPage() {
  const { user, choosePlan } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api
      .get('/plans')
      .then((d) => setPlans(d.plans))
      .catch((e) => setError(e.message || 'Не удалось загрузить планы'));
  }, []);

  const select = async (planId) => {
    setError('');
    setNotice('');
    try {
      await choosePlan(planId, false);
      navigate('/');
    } catch (e) {
      if (e.status === 409 && e.data?.error === 'plan-change-confirmation-required') {
        const ok = window.confirm(
          e.data.message ||
            'При смене плана началом участия станет сегодняшний день. Отметки по новому плану начнут считаться заново. Продолжить?'
        );
        if (!ok) return;
        try {
          await choosePlan(planId, true);
          navigate('/');
        } catch (e2) {
          setError(e2.message);
        }
      } else {
        setError(e.message);
      }
    }
  };

  return (
    <div className="container py-3">
      <h1 className="h5 mb-3">План чтения</h1>
      {error && <div className="alert alert-danger">{error}</div>}
      {notice && <div className="alert alert-info">{notice}</div>}

      {plans.map((p) => {
        const active = user.planId === p.id;
        return (
          <button
            type="button"
            key={p.id}
            className={`plan-card card-soft p-3 mb-3 text-start w-100 ${active ? 'selected' : ''}`}
            disabled={active}
            onClick={() => select(p.id)}
          >
            <div className="d-flex justify-content-between align-items-center gap-2">
              <div className="h6 mb-0">
              {p.name} {active && <span className="badge text-bg-primary ms-1">выбран</span>}
              </div>
              <span className="plan-card-arrow" aria-hidden="true">{active ? '✓' : '→'}</span>
            </div>
            <div className="text-muted small">{p.description}</div>
            <div className="plan-card-action">{active ? 'Текущий план' : user.planId ? 'Перейти на этот план' : 'Выбрать план'}</div>
          </button>
        );
      })}
    </div>
  );
}
