'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AddressDetails, AddressEditor } from '@/components/AddressEditor';
import { api } from '@/lib/api';

interface Address {
  id: string;
  label: string;
  address: string;
  entrance: string | null;
  floor: string | null;
  apartment: string | null;
  comment: string | null;
  isDefault: boolean;
}

const emptyForm = { label: '', address: '', entrance: '', floor: '', apartment: '', comment: '', isDefault: false };

export default function AddressesPage() {
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = () =>
    api('/addresses')
      .then((list: Address[]) => {
        setAddresses(list);
        if (!loaded) {
          if (list.length > 0) startEdit(list[0]);
          else startNew();
        }
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoaded(true));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startEdit(a: Address) {
    setForm({
      label: a.label,
      address: a.address,
      entrance: a.entrance ?? '',
      floor: a.floor ?? '',
      apartment: a.apartment ?? '',
      comment: a.comment ?? '',
      isDefault: a.isDefault,
    });
    setError('');
    setEditingId(a.id);
  }
  function startNew() {
    setForm(emptyForm);
    setError('');
    setEditingId('new');
  }

  async function save() {
    setError('');
    setSubmitting(true);
    try {
      const body = JSON.stringify({
        label: form.label,
        address: form.address,
        entrance: form.entrance || undefined,
        floor: form.floor || undefined,
        apartment: form.apartment || undefined,
        comment: form.comment || undefined,
        isDefault: form.isDefault,
      });
      if (editingId === 'new') {
        const created = await api('/addresses', { method: 'POST', body });
        setEditingId(created.id);
      } else if (editingId) {
        await api(`/addresses/${editingId}`, { method: 'PATCH', body });
      }
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    setError('');
    try {
      await api(`/addresses/${id}`, { method: 'DELETE' });
      setEditingId(null);
      const rest = addresses.filter((a) => a.id !== id);
      if (rest.length > 0) startEdit(rest[0]);
      else startNew();
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-6 md:px-8">
      <span className="text-xl font-extrabold text-ink">{t('addresses.title')}</span>
      <div className="flex flex-col gap-6 xl:flex-row">
        <div className="flex w-full max-w-[360px] shrink-0 flex-col gap-2">
          {addresses.length === 0 && (
            <div className="rounded-lg border-[1.5px] border-dashed border-border bg-surface p-6 text-center text-sm font-semibold text-ink-soft">
              {t('addresses.empty')}
            </div>
          )}
          {addresses.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => startEdit(a)}
              className={`rounded-md border px-3.5 py-3.5 text-left ${
                editingId === a.id ? 'border-primary bg-fill-soft' : 'border-border bg-surface'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-extrabold text-ink">
                  {a.label} {a.isDefault && '★'}
                </span>
                <span className="text-xs font-extrabold text-primary">{t('addresses.change')}</span>
              </div>
              <div className="mt-0.5 text-xs text-ink-soft">
                {a.address}
                <AddressDetails entrance={a.entrance} floor={a.floor} apartment={a.apartment} />
              </div>
            </button>
          ))}
          <button
            type="button"
            onClick={startNew}
            className="rounded-md border-[1.5px] border-dashed border-primary p-3.5 text-center text-sm font-extrabold text-primary"
          >
            ＋ {t('addresses.addNew')}
          </button>
        </div>
        <AddressEditor value={form} onChange={setForm} isNew={editingId === 'new'} submitting={submitting}
          error={error} onSave={save} onDelete={editingId !== 'new' && editingId != null ? () => remove(editingId) : undefined} />
      </div>
    </div>
  );
}
