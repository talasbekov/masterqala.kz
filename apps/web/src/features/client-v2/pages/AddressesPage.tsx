import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ArrowLeftIcon,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  MapPinIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from '@masterqala/ui';
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
          <IconButton
            label={t('common.back')}
            icon={<ArrowLeftIcon />}
            onClick={() => setEditingId(null)}
          />
          <h1 className="text-lg font-extrabold text-ink">
            {editingId === 'new' ? t('addresses.addTitle') : t('addresses.editTitle')}
          </h1>
        </div>
        <Input
          label={t('addresses.labelPlaceholder')}
          required
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
        />
        <Input
          label={t('addresses.addressPlaceholder')}
          required
          autoComplete="street-address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <div className="grid grid-cols-3 gap-2">
          <Input
            label={t('addresses.entrance')}
            inputMode="numeric"
            value={form.entrance}
            onChange={(e) => setForm({ ...form, entrance: e.target.value })}
          />
          <Input
            label={t('addresses.floor')}
            inputMode="numeric"
            value={form.floor}
            onChange={(e) => setForm({ ...form, floor: e.target.value })}
          />
          <Input
            label={t('addresses.apartment')}
            inputMode="numeric"
            value={form.apartment}
            onChange={(e) => setForm({ ...form, apartment: e.target.value })}
          />
        </div>
        <Input
          label={t('addresses.commentPlaceholder')}
          value={form.comment}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
        />
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            className="size-5 accent-primary"
            checked={form.isDefault}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          />
          {t('addresses.setDefault')}
        </label>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="mt-auto" />
        <Button
          fullWidth
          size="lg"
          loading={submitting}
          disabled={!form.label || !form.address}
          onClick={save}
        >
          {t('addresses.save')}
        </Button>
        {editingId !== 'new' && (
          <Button
            fullWidth
            variant="secondary"
            icon={<TrashIcon size={18} />}
            className="text-danger"
            onClick={() => remove(editingId)}
          >
            {t('addresses.delete')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-2.5">
        <IconButton
          label={t('common.back')}
          icon={<ArrowLeftIcon />}
          onClick={() => navigate('/profile')}
        />
        <h1 className="text-xl font-extrabold text-ink">{t('addresses.title')}</h1>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {addresses.length === 0 && (
        <EmptyState
          icon={<MapPinIcon size={32} />}
          title={t('addresses.empty')}
          action={
            <Button icon={<PlusIcon size={18} />} onClick={startNew}>
              {t('addresses.addNew')}
            </Button>
          }
        />
      )}
      {addresses.map((a) => (
        <Card key={a.id} padding="none">
          <button
            type="button"
            onClick={() => startEdit(a)}
            className="w-full px-3.5 py-3.5 text-left"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-ink">
                {a.label}
                {a.isDefault && (
                  <StarIcon size={16} className="text-warning" title={t('addresses.setDefault')} />
                )}
              </span>
              <span className="text-xs font-extrabold text-primary">{t('addresses.change')}</span>
            </div>
            <div className="mt-0.5 text-xs text-ink-soft">
              {a.address}
              {a.entrance && ` · под. ${a.entrance}`}
              {a.floor && `, эт. ${a.floor}`}
              {a.apartment && `, кв. ${a.apartment}`}
            </div>
          </button>
        </Card>
      ))}
      {addresses.length > 0 && (
        <Button fullWidth variant="secondary" icon={<PlusIcon size={18} />} onClick={startNew}>
          {t('addresses.addNew')}
        </Button>
      )}
    </div>
  );
}
