import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { getSocket } from '../socket';
import { useAuth } from '../auth';
import { STATUS_LABELS, urgentStatusVariant } from '../orderStatus';
import { Card, Avatar, StatusPill, CategoryTile, categoryIcon, ChevronRightIcon } from '@masterqala/ui';

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () =>
    api('/orders/active')
      .then((r) => setOrder(r.order))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    api('/categories').then(setCategories);
    const socket = getSocket();
    const onStatus = () => load();
    socket.on('order:status', onStatus);
    return () => {
      socket.off('order:status', onStatus);
    };
  }, []);

  if (loading) return <div className="p-6 text-muted">Загрузка…</div>;

  return (
    <div className="mx-auto max-w-sm space-y-6 p-6">
      <div>
        <p className="text-sm text-muted">Добрый день</p>
        <h1 className="text-xl font-extrabold text-foreground">{user?.name ?? 'Гость'}</h1>
      </div>

      {order && (
        <Link to={`/order/${order.id}`}>
          <Card className="flex items-center gap-3">
            <Avatar name={order.master?.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-foreground">{order.category?.name}</div>
              <div className="truncate text-sm text-muted">{order.address}</div>
              <div className="mt-1.5">
                <StatusPill variant={urgentStatusVariant(order.status)}>{STATUS_LABELS[order.status]}</StatusPill>
              </div>
            </div>
          </Card>
        </Link>
      )}

      {categories.length > 0 && (
        <div>
          <h2 className="mb-2 text-[15px] font-extrabold text-foreground">Категории услуг</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {categories.map((c) => {
              const { Icon, bg, color } = categoryIcon(c.slug);
              return (
                <CategoryTile
                  key={c.id}
                  label={c.name}
                  icon={<Icon className="h-6 w-6" />}
                  iconBg={bg}
                  iconColor={color}
                  onClick={() => navigate('/order/new')}
                />
              );
            })}
          </div>
        </div>
      )}

      {!order && (
        <button
          onClick={() => navigate('/order/new')}
          className="flex w-full items-center justify-between gap-3 rounded-lg bg-primary p-4 text-left text-white"
        >
          <div>
            <div className="font-bold">Срочно нужен мастер?</div>
            <div className="mt-0.5 text-[13px] opacity-85">Найдём ближайшего свободного</div>
          </div>
          <span className="shrink-0 rounded-full bg-accent px-4 py-2 text-[13px] font-bold">Вызвать</span>
        </button>
      )}

      <Link
        to="/planned/new"
        className="flex items-center justify-between rounded-md border-2 border-dashed border-primary-light/40 bg-surface p-3.5"
      >
        <div>
          <div className="text-[13px] font-bold text-primary">Запланировать на удобное время</div>
          <div className="text-xs text-muted">Ставки от мастеров, вы выбираете</div>
        </div>
        <ChevronRightIcon className="h-4 w-4 text-primary" />
      </Link>
    </div>
  );
}
