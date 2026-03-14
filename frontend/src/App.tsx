import { Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import DashboardPage from './pages/DashboardPage';
import ReviewPage from './pages/ReviewPage';
import AdminUsersPage from './pages/AdminUsersPage';

export default function App() {
  return (
    <AuthGuard>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/review/:reviewId" element={<ReviewPage />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
      </Routes>
    </AuthGuard>
  );
}
