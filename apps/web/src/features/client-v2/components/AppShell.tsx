import { Outlet } from 'react-router-dom';
import BottomTabBar from './BottomTabBar';

export default function AppShell() {
  return (
    <div className="flex min-h-screen flex-col bg-c2-bg">
      <div className="flex-1 pb-2">
        <Outlet />
      </div>
      <BottomTabBar />
    </div>
  );
}
