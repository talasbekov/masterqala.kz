import {useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {AccountAddressBook} from '@masterqala/ui';
import {api} from '../../../api';
import {useAuth} from '../../../auth';
export default function AddressesPage(){const {user}=useAuth();const {t}=useTranslation();const navigate=useNavigate();return <AccountAddressBook ownerId={user?.id??null} api={api} t={key=>t(key)} onBack={()=>navigate('/profile')}/>;}
