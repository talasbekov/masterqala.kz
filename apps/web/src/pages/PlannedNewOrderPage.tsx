import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

function minDateTimeLocal(): string {
  const d = new Date(Date.now() + 3600_000);
  return d.toISOString().slice(0, 16);
}

function maxDateTimeLocal(): string {
  const d = new Date(Date.now() + 14 * 24 * 3600_000);
  return d.toISOString().slice(0, 16);
}

export default function PlannedNewOrderPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [scheduledAt, setScheduledAt] = useState(minDateTimeLocal());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api('/categories').then(setCategories);
    api('/users/me').then((me) => setAddress(me.defaultAddress ?? ''));
  }, []);

  const canSubmit = categoryId && description && address && district && scheduledAt && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const order = await api('/planned-orders', {
        method: 'POST',
        body: JSON.stringify({
          categoryId,
          description,
          address,
          district,
          scheduledAt: new Date(scheduledAt).toISOString(),
        }),
      });
      navigate(`/planned/${order.id}`);
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-4">
      <h1 className="text-2xl font-bold">Запланировать заявку</h1>

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

      <input
        className="w-full rounded border p-3"
        placeholder="Адрес (улица, дом, квартира)"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <input
        className="w-full rounded border p-3"
        placeholder="Район"
        value={district}
        onChange={(e) => setDistrict(e.target.value)}
      />
      <div className="space-y-1">
        <label className="text-sm text-gray-600">Дата и время</label>
        <input
          type="datetime-local"
          className="w-full rounded border p-3"
          value={scheduledAt}
          min={minDateTimeLocal()}
          max={maxDateTimeLocal()}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
      </div>

      <p className="text-sm text-gray-600">
        Мастера увидят категорию, район и описание и предложат свою цену. Вы выбираете лучшую ставку.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        disabled={!canSubmit}
        onClick={submit}
        className="w-full rounded bg-teal-700 p-3 text-white disabled:opacity-40"
      >
        {submitting ? 'Публикуем…' : 'Опубликовать заявку'}
      </button>
    </div>
  );
}
