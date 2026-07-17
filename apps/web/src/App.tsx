import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import Layout from './Layout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import BecomeMasterPage from './pages/BecomeMasterPage';
import AdminListPage from './pages/AdminListPage';
import AdminDetailPage from './pages/AdminDetailPage';
import AdminWithdrawalsPage from './pages/AdminWithdrawalsPage';
import AdminDisputesPage from './pages/AdminDisputesPage';
import AdminDisputeDetailPage from './pages/AdminDisputeDetailPage';
import NewOrderPage from './pages/NewOrderPage';
import OrderPage from './pages/OrderPage';
import MyOrdersPage from './pages/MyOrdersPage';
import WorkPage from './pages/WorkPage';
import PlannedNewOrderPage from './pages/PlannedNewOrderPage';
import PlannedOrderPage from './pages/PlannedOrderPage';
import LeadCreditsPage from './pages/LeadCreditsPage';
import WalletPage from './pages/WalletPage';

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
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/orders" element={<MyOrdersPage />} />
              <Route path="/order/new" element={<NewOrderPage />} />
              <Route path="/order/:id" element={<OrderPage />} />
              <Route path="/planned/new" element={<PlannedNewOrderPage />} />
              <Route path="/planned/:id" element={<PlannedOrderPage />} />
              <Route path="/work" element={<WorkPage />} />
              <Route path="/lead-credits" element={<LeadCreditsPage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
            <Route path="/become-master" element={<BecomeMasterPage />} />
            <Route element={<RequireOperator />}>
              <Route path="/admin" element={<AdminListPage />} />
              <Route path="/admin/:id" element={<AdminDetailPage />} />
              <Route path="/admin/withdrawals" element={<AdminWithdrawalsPage />} />
              <Route path="/admin/disputes" element={<AdminDisputesPage />} />
              <Route path="/admin/disputes/:id" element={<AdminDisputeDetailPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
