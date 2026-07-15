import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Geo {
  lat: number;
  lng: number;
}

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [geo, setGeo] = useState<Geo | null>(null);
  const [geoError, setGeoError] = useState('');
  const [preview, setPreview] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function detectGeo() {
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeoError('Не удалось определить геолокацию — разрешите доступ и нажмите «Обновить»'),
    );
  }

  useEffect(() => {
    api('/categories').then(setCategories);
    api('/users/me').then((me) => setAddress(me.defaultAddress ?? ''));
    detectGeo();
  }, []);

  useEffect(() => {
    if (!categoryId || !geo) return setPreview(null);
    api('/orders/preview', { method: 'POST', body: JSON.stringify({ categoryId, ...geo }) })
      .then(setPreview)
      .catch(() => setPreview(null));
  }, [categoryId, geo]);

  async function submit() {
    if (!categoryId || !geo || !description || !address) return;
    setSubmitting(true);
    setError('');
    try {
      const order = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({ categoryId, description, address, ...geo }),
      });
      navigate(`/order/${order.id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  const canSubmit = categoryId && geo && description && address && preview?.available && !submitting;

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-2xl font-bold">Вызвать мастера</h1>

      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryId(c.id)}
            className={`rounded-full border px-4 py-2 text-sm ${categoryId === c.id ? 'border-teal-700 bg-teal-700 text-white' : ''}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <textarea
        className="w-full rounded border p-3"
        rows={3}
        placeholder="Опишите проблему"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className={geo ? 'text-teal-700' : 'text-gray-500'}>
            {geo ? 'Геолокация определена' : 'Определяем геолокацию…'}
          </span>
          <button className="text-teal-700 underline" onClick={detectGeo}>Обновить</button>
        </div>
        {geoError && <p className="text-sm text-red-600">{geoError}</p>}
        <input
          className="w-full rounded border p-3"
          placeholder="Адрес (улица, дом, квартира)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      {preview && preview.available && (
        <div className="rounded-xl bg-teal-50 p-4">
          <div className="text-lg font-semibold">Выезд: {preview.calloutPrice} ₸</div>
          <p className="text-sm text-gray-600">
            Работа оплачивается мастеру напрямую после согласования цены.
          </p>
        </div>
      )}
      {preview && !preview.available && (
        <div className="rounded-xl bg-amber-50 p-4 text-sm">Мастеров рядом нет — попробуйте позже.</div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        disabled={!canSubmit}
        onClick={submit}
        className="w-full rounded bg-teal-700 p-3 text-white disabled:opacity-40"
      >
        {submitting ? 'Создаём…' : 'Вызвать мастера'}
      </button>
    </div>
  );
}
