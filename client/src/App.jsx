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
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end>
        <span className="icon">📖</span>
        Чтение
      </NavLink>
      <NavLink to="/progress">
        <span className="icon">📊</span>
        Прогресс
      </NavLink>
      <NavLink to="/notes">
        <span className="icon">📝</span>
        Заметки
      </NavLink>
      <NavLink to="/leaderboard">
        <span className="icon">🏆</span>
        Рейтинг
      </NavLink>
      <NavLink to="/settings">
        <span className="icon">⚙️</span>
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
