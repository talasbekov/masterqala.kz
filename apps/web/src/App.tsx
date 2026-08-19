import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import Layout from './Layout';
import LoginPage from './features/client-v2/pages/LoginPage';
import AppShell from './features/client-v2/components/AppShell';
import HomePage from './features/client-v2/pages/HomePage';
import NotificationsPage from './features/client-v2/pages/NotificationsPage';
import CatalogPage from './features/client-v2/pages/CatalogPage';
import ProfilePage from './features/client-v2/pages/ProfilePage';
import NewOrderPage from './features/client-v2/pages/NewOrderPage';
import OrderPage from './features/client-v2/pages/OrderPage';
import DisputePage from './features/client-v2/pages/DisputePage';
import MyOrdersPage from './features/client-v2/pages/MyOrdersPage';
import PlannedNewOrderPage from './features/client-v2/pages/PlannedNewOrderPage';
import PlannedOrderPage from './features/client-v2/pages/PlannedOrderPage';
import PlannedComparePage from './features/client-v2/pages/PlannedComparePage';
import AddressesPage from './features/client-v2/pages/AddressesPage';
import SupportPage from './features/client-v2/pages/SupportPage';
import PaymentsPage from './features/client-v2/pages/PaymentsPage';

function RequireAuth() {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

// apps/web — мобильный клиент (решение 2026-08-18, docs/STATUS.md). Экраны
// мастера и админки задублированы для десктопа в apps/master/apps/operator
// и здесь сознательно выпилены — держать три копии одной бизнес-логики
// дороже, чем починить одну.
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/orders" element={<MyOrdersPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
            <Route element={<Layout />}>
              <Route path="/order/new" element={<NewOrderPage />} />
              <Route path="/order/:id" element={<OrderPage />} />
              <Route path="/order/:id/dispute" element={<DisputePage kind="orders" />} />
              <Route path="/planned/new" element={<PlannedNewOrderPage />} />
              <Route path="/planned/:id" element={<PlannedOrderPage />} />
              <Route path="/planned/:id/compare" element={<PlannedComparePage />} />
              <Route path="/planned/:id/dispute" element={<DisputePage kind="planned-orders" />} />
              <Route path="/profile/addresses" element={<AddressesPage />} />
              <Route path="/profile/payments" element={<PaymentsPage />} />
              <Route path="/support" element={<SupportPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
