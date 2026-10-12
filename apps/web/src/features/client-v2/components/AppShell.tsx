import { Outlet,useLocation } from 'react-router-dom';
import BottomTabBar from './BottomTabBar';

export default function AppShell() {
  const path=useLocation().pathname;
  const orderPage=/^\/order\/[^/]+$/.test(path)&&!path.endsWith('/new');
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
      {!orderPage&&<BottomTabBar />}
    </div>
  );
}
