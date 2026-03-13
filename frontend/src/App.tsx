import { Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import DashboardPage from './pages/DashboardPage';
import ReviewPage from './pages/ReviewPage';

export default function App() {
  return (
    <AuthGuard>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/review/:reviewId" element={<ReviewPage />} />
      </Routes>
    </AuthGuard>
  );
}
