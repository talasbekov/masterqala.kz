import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './features/client-v2/i18n';
import App from './App.tsx';
import { CommercialModeProvider } from './commercial-mode';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CommercialModeProvider>
      <App />
    </CommercialModeProvider>
  </StrictMode>,
);
