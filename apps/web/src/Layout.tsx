import { Outlet,useLocation } from 'react-router-dom';
import TabBar from './components/TabBar';
export default function Layout() {
 const path=useLocation().pathname;
 const orderPage=/^\/order\/[^/]+$/.test(path)&&!path.endsWith('/new');
 return <div className={`min-h-screen min-w-0 bg-background ${orderPage?'':'pb-20'}`}><Outlet />{!orderPage&&<TabBar />}</div>;
}
