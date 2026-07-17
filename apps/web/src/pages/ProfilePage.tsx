import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [saved, setSaved] = useState(false);
  const [blockedUntil, setBlockedUntil] = useState<string | null>(null);

  useEffect(() => {
    api('/users/me').then((me) => {
      setName(me.name ?? '');
      setAddress(me.defaultAddress ?? '');
      setBlockedUntil(me.masterProfile?.blockedUntil ?? null);
    });
  }, []);

  async function save() {
    await api('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ name, defaultAddress: address }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Профиль</h1>
        <button className="text-sm text-gray-500" onClick={logout}>Выйти</button>
      </div>
      <p className="text-gray-600">{user?.phone}</p>
      <input className="w-full rounded border p-3" placeholder="Имя" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="w-full rounded border p-3" placeholder="Адрес по умолчанию" value={address} onChange={(e) => setAddress(e.target.value)} />
      <button className="w-full rounded bg-teal-700 p-3 text-white" onClick={save}>
        {saved ? 'Сохранено ✓' : 'Сохранить'}
      </button>
      {blockedUntil && new Date(blockedUntil) > new Date() && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          Доступ к новым заявкам временно ограничен до {new Date(blockedUntil).toLocaleDateString('ru-RU')}
        </div>
      )}
      <Link to="/become-master" className="block text-center text-teal-700 underline">
        Стать мастером
      </Link>
      <Link to="/wallet" className="block text-center text-teal-700 underline">
        Кошелёк
      </Link>
      {user?.role === 'OPERATOR' && (
        <Link to="/admin" className="block text-center text-teal-700 underline">
          Панель оператора
        </Link>
      )}
    </div>
  );
}
