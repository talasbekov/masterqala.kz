import {Navigate,Outlet,useLocation} from 'react-router-dom';
import {protectedLoginUrl} from '@masterqala/ui';
import {useAuth} from './auth';
export function RequireAuth(){
 const {user}=useAuth();const location=useLocation();
 return user?<Outlet/>:<Navigate to={protectedLoginUrl(location.pathname+location.search+location.hash)} replace/>;
}
