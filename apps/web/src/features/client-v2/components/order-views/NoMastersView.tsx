import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, EmptyState, InboxIcon } from '@masterqala/ui';
import { api } from '../../../../api';

export default function NoMastersView({
  orderId,
  freePilot,
  onChanged,
}: {
  orderId: string;
  freePilot: boolean;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
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
    <div className="flex min-h-[70vh] flex-col justify-center px-6">
      <EmptyState
        icon={<InboxIcon size={40} />}
        title={t('orderDetail.noMastersTitle')}
        subtitle={
          freePilot
            ? 'Сейчас рядом нет свободных мастеров. Списаний не было. Попробуйте поиск ещё раз или создайте плановую заявку — мастера сами предложат цену.'
            : t('orderDetail.noMastersText')
        }
        action={
          <div className="flex w-full flex-col gap-2.5">
            {error && <Alert tone="danger">{error}</Alert>}
            <Button fullWidth onClick={retry}>
              {t('orderDetail.retrySearch')}
            </Button>
            <Button variant="secondary" fullWidth onClick={() => navigate('/planned/new')}>
              {t('orderDetail.startPlanned')}
            </Button>
            <Button variant="ghost" fullWidth onClick={() => navigate('/')}>
              {t('orderDetail.toHome')}
            </Button>
          </div>
        }
      />
    </div>
  );
}
