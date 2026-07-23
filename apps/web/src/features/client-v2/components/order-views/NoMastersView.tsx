import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../api';
import { useCommercialMode } from '../../../../commercial-mode';

export default function NoMastersView({ orderId, onChanged }: { orderId: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const { paymentsEnabled } = useCommercialMode();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  async function retry() {
    setError('');
    try {
      await api(`/orders/${orderId}/retry-search`, { method: 'POST' });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3.5 px-6 text-center">
      <div className="text-4xl">😔</div>
      <div className="text-xl font-extrabold text-c2-ink">{t('orderDetail.noMastersTitle')}</div>
      <div className="max-w-[290px] text-sm leading-relaxed text-c2-ink-soft">
        {paymentsEnabled
          ? t('orderDetail.noMastersText')
          : 'Сейчас рядом нет свободных мастеров. Списаний не было. Попробуйте поиск ещё раз или создайте плановую заявку — мастера сами предложат цену.'}
      </div>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
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
