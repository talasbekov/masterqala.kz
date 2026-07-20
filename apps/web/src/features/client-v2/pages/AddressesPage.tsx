import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';

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
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => api('/addresses').then(setAddresses).catch((e) => setError((e as Error).message));

  useEffect(() => {
    load();
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
        await api('/addresses', { method: 'POST', body });
      } else if (editingId) {
        await api(`/addresses/${editingId}`, { method: 'PATCH', body });
      }
      setEditingId(null);
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
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (editingId) {
    return (
      <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => setEditingId(null)} className="text-xl text-c2-primary">
            ←
          </button>
          <span className="text-lg font-extrabold text-c2-ink">
            {editingId === 'new' ? t('addresses.addTitle') : t('addresses.editTitle')}
          </span>
        </div>
        <input
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder={t('addresses.labelPlaceholder')}
          className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
        />
        <input
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          placeholder={t('addresses.addressPlaceholder')}
          className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            value={form.entrance}
            onChange={(e) => setForm({ ...form, entrance: e.target.value })}
            placeholder={t('addresses.entrance')}
            className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-2.5 text-center text-sm text-c2-ink outline-none placeholder:text-c2-muted"
          />
          <input
            value={form.floor}
            onChange={(e) => setForm({ ...form, floor: e.target.value })}
            placeholder={t('addresses.floor')}
            className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-2.5 text-center text-sm text-c2-ink outline-none placeholder:text-c2-muted"
          />
          <input
            value={form.apartment}
            onChange={(e) => setForm({ ...form, apartment: e.target.value })}
            placeholder={t('addresses.apartment')}
            className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-2.5 text-center text-sm text-c2-ink outline-none placeholder:text-c2-muted"
          />
        </div>
        <input
          value={form.comment}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
          placeholder={t('addresses.commentPlaceholder')}
          className="rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface p-3 text-sm text-c2-ink outline-none placeholder:text-c2-muted"
        />
        <label className="flex items-center gap-2 text-sm font-semibold text-c2-ink">
          <input
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          />
          {t('addresses.setDefault')}
        </label>
        {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
        <div className="mt-auto" />
        <button
          type="button"
          onClick={save}
          disabled={submitting || !form.label || !form.address}
          className="rounded-c2-pill bg-c2-primary p-4 text-[15px] font-extrabold text-white disabled:opacity-40"
        >
          {t('addresses.save')}
        </button>
        {editingId !== 'new' && (
          <button
            type="button"
            onClick={() => remove(editingId)}
            className="rounded-c2-pill border-[1.5px] border-c2-danger p-3 text-sm font-extrabold text-c2-danger"
          >
            {t('addresses.delete')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <button type="button" onClick={() => navigate('/profile')} className="text-xl text-c2-primary">
          ←
        </button>
        <span className="text-xl font-extrabold text-c2-ink">{t('addresses.title')}</span>
      </div>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      {addresses.length === 0 && (
        <div className="rounded-c2-lg border-[1.5px] border-dashed border-c2-border bg-c2-surface p-6 text-center text-sm font-semibold text-c2-ink-soft">
          {t('addresses.empty')}
        </div>
      )}
      {addresses.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => startEdit(a)}
          className="rounded-c2-md border border-c2-border bg-c2-surface px-3.5 py-3.5 text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-extrabold text-c2-ink">
              {a.label} {a.isDefault && '★'}
            </span>
            <span className="text-xs font-extrabold text-c2-primary">{t('addresses.change')}</span>
          </div>
          <div className="mt-0.5 text-xs text-c2-ink-soft">
            {a.address}
            {a.entrance && ` · под. ${a.entrance}`}
            {a.floor && `, эт. ${a.floor}`}
            {a.apartment && `, кв. ${a.apartment}`}
          </div>
        </button>
      ))}
      <button
        type="button"
        onClick={startNew}
        className="rounded-c2-md border-[1.5px] border-dashed border-c2-primary p-3.5 text-center text-sm font-extrabold text-c2-primary"
      >
        ＋ {t('addresses.addNew')}
      </button>
    </div>
  );
}
