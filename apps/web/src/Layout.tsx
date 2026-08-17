import { Outlet } from 'react-router-dom';
import TabBar from './components/TabBar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <a href="#main" className="skip-link">
        К основному содержимому
      </a>
      <main id="main">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
