import { Outlet } from 'react-router-dom';
import BottomTabBar from './BottomTabBar';

export default function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a href="#main" className="skip-link">
        К основному содержимому
      </a>
      <main id="main" className="flex-1 pb-2">
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
}
