import {Link,useLocation,useNavigate} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {AccountProfileView,LanguageDialogController,useLanguageDialog,useLocale,LOCALE_COPY} from '@masterqala/ui';
import {api} from '../../../api';
import {useAuth} from '../../../auth';
const items=[['addresses','/profile/addresses'],['payments','/profile/payments'],['notifications','/notifications'],['support','/support']] as const;
function LanguageControl(){const {language}=useLocale();const open=useLanguageDialog();return <button type="button" className="mq-field mq-field--full mq-profile-language" aria-haspopup="dialog" aria-label={LOCALE_COPY[language].title} onClick={open}><span className="mq-profile-language-value">{({ru:'Русский',kk:'Қазақша',en:'English'})[language]}</span></button>;}
export default function ProfilePage(){
 const {t}=useTranslation();const {user,logout}=useAuth();const {language,setLanguage}=useLocale();const location=useLocation();const navigate=useNavigate();
 const href=location.pathname+location.search+location.hash;
 return <LanguageDialogController href={href} locale={language} onSelect={setLanguage} router={{push:url=>navigate(url),replace:url=>navigate(url,{replace:true}),back:()=>navigate(-1)}}>
  <AccountProfileView ownerId={user?.id??null} phoneFallback={user?.phone} api={api} t={key=>t(key)} languageControl={<LanguageControl/>} onLogout={()=>{logout();navigate('/login');}}>
   {items.map(([key,to])=><Link key={key} to={to} className="flex min-h-[56px] items-center justify-between rounded-md bg-fill-soft px-4 py-3 text-primary">{t(`profile.items.${key}`)}<span aria-hidden>›</span></Link>)}
  </AccountProfileView>
 </LanguageDialogController>;
}
