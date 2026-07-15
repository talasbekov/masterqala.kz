import { Outlet } from 'react-router-dom';
import TabBar from './components/TabBar';

export default function Layout() {
  return (
    <div className="pb-16">
      <Outlet />
      <TabBar />
    </div>
  );
}
