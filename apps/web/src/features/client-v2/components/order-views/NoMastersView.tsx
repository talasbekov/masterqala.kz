import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';

export default function NoMastersView({ orderId, onChanged }: { orderId: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function retry() {
    await api(`/orders/${orderId}/retry-search`, { method: 'POST' });
    onChanged();
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3.5 px-6 text-center">
      <div className="text-4xl">😔</div>
      <div className="text-xl font-extrabold text-c2-ink">{t('orderDetail.noMastersTitle')}</div>
      <div className="max-w-[290px] text-sm leading-relaxed text-c2-ink-soft">{t('orderDetail.noMastersText')}</div>
      <button
        type="button"
        onClick={retry}
        className="mt-2 w-full rounded-c2-pill bg-c2-primary p-4 text-sm font-extrabold text-white"
      >
        {t('orderDetail.retrySearch')}
      </button>
      <button
        type="button"
        onClick={() => navigate('/planned/new')}
        className="w-full rounded-c2-pill border-[1.5px] border-c2-primary p-3.5 text-sm font-extrabold text-c2-primary"
      >
        {t('orderDetail.startPlanned')}
      </button>
      <button type="button" onClick={() => navigate('/')} className="text-sm font-bold text-c2-ink-soft">
        {t('orderDetail.toHome')}
      </button>
    </div>
  );
}
