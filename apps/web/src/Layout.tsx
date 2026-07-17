import { Outlet } from 'react-router-dom';
import TabBar from './components/TabBar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Outlet />
      <TabBar />
    </div>
  );
}
