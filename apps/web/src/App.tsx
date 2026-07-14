import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import BecomeMasterPage from './pages/BecomeMasterPage';
import AdminListPage from './pages/AdminListPage';
import AdminDetailPage from './pages/AdminDetailPage';

function RequireAuth() {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function RequireOperator() {
  const { user } = useAuth();
  return user?.role === 'OPERATOR' ? <Outlet /> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/become-master" element={<BecomeMasterPage />} />
            <Route element={<RequireOperator />}>
              <Route path="/admin" element={<AdminListPage />} />
              <Route path="/admin/:id" element={<AdminDetailPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
