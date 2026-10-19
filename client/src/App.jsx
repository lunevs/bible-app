import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import AuthPage from './pages/AuthPage.jsx';
import HomePage from './pages/HomePage.jsx';
import PlanSelectPage from './pages/PlanSelectPage.jsx';
import ReadingPage from './pages/ReadingPage.jsx';
import ProgressPage from './pages/ProgressPage.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import OpenNotesPage from './pages/OpenNotesPage.jsx';

function BottomNav() {
  const { user } = useAuth();
  if (!user) return null;

  const icons = {
    read: <><path d="M12 7v14" /><path d="M3 18V5a1 1 0 0 1 1-1h4a4 4 0 0 1 4 4 4 4 0 0 1 4-4h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4a4 4 0 0 0-4 2 4 4 0 0 0-4-2H4a1 1 0 0 1-1-1Z" /></>,
    progress: <><path d="M4 19V5" /><path d="M4 19h17" /><path d="m7 15 4-4 3 2 5-6" /></>,
    notes: <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></>,
    leaderboard: <><path d="M8 21h8" /><path d="M12 17v4" /><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 7H4v2a4 4 0 0 0 4 4" /><path d="M17 7h3v2a4 4 0 0 1-4 4" /></>,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  };

  const Icon = ({ name }) => (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );

  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      <NavLink to="/" end>
        <Icon name="read" />
        Чтение
      </NavLink>
      <NavLink to="/progress">
        <Icon name="progress" />
        Прогресс
      </NavLink>
      <NavLink to="/notes">
        <Icon name="notes" />
        Заметки
      </NavLink>
      <NavLink to="/leaderboard">
        <Icon name="leaderboard" />
        Рейтинг
      </NavLink>
      <NavLink to="/settings">
        <Icon name="more" />
        Ещё
      </NavLink>
    </nav>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/plans" element={<PlanSelectPage />} />
        <Route path="/read/:planId/:date" element={<ReadingPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/notes" element={<OpenNotesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={user.role === 'admin' ? <AdminPage /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
