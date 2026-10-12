import {LocaleProvider} from '@masterqala/ui';
import {api} from './api';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './features/client-v2/i18n';
import App from './App.tsx';
import { CommercialModeProvider } from './commercial-mode';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider onChange={language=>{if(localStorage.getItem('token')) void api('/users/me',{method:'PATCH',body:JSON.stringify({language})}).catch(()=>{});}}><CommercialModeProvider>
      <App />
    </CommercialModeProvider></LocaleProvider>
  </StrictMode>,
);
