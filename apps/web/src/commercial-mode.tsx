import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { api } from './api';

export type CommercialMode = 'FREE_PILOT' | 'PAID_MOCK' | 'PAID_LIVE';

export interface CommercialConfig {
  commercialMode: CommercialMode;
  paymentsEnabled: boolean;
  leadCreditsEnabled: boolean;
  payoutsEnabled: boolean;
}

const SAFE_DEFAULT: CommercialConfig = {
  commercialMode: 'FREE_PILOT',
  paymentsEnabled: false,
  leadCreditsEnabled: false,
  payoutsEnabled: false,
};

const CommercialModeContext = createContext<CommercialConfig>(SAFE_DEFAULT);

export function CommercialModeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<CommercialConfig>(SAFE_DEFAULT);

  useEffect(() => {
    api('/config/public')
      .then((value) => setConfig(value as CommercialConfig))
      .catch(() => setConfig(SAFE_DEFAULT));
  }, []);

  return <CommercialModeContext.Provider value={config}>{children}</CommercialModeContext.Provider>;
}

export function useCommercialMode() {
  return useContext(CommercialModeContext);
}
