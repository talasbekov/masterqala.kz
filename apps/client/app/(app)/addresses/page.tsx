'use client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Input, PlusIcon, StarIcon, TrashIcon } from '@masterqala/ui';
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
  /* Ошибки полей живут отдельно от ошибки запроса: они встают у самого поля и
   * связываются с ним через aria-describedby (см. Field в @masterqala/ui). */
  const [fieldErrors, setFieldErrors] = useState<{ label?: string; address?: string }>({});
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
    setFieldErrors({});
    setEditingId(a.id);
  }
  function startNew() {
    setForm(emptyForm);
    setError('');
    setFieldErrors({});
    setEditingId('new');
  }

  async function save() {
    setError('');
    const nextErrors: { label?: string; address?: string } = {};
    if (!form.label.trim()) nextErrors.label = t('addresses.labelRequired');
    if (!form.address.trim()) nextErrors.address = t('addresses.addressRequired');
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

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
    <div className="flex flex-col gap-4 px-5 py-6 sm:px-8">
      <h1 className="text-xl font-extrabold text-ink">{t('addresses.title')}</h1>
      {/* Ниже lg колонки складываются: фиксированные 360px + 420px не помещались
       * уже на 1100px и резали форму. */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex flex-col gap-2 lg:w-[360px] lg:shrink-0">
          {addresses.length === 0 && (
            <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-center text-sm font-semibold text-ink-soft">
              {t('addresses.empty')}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {addresses.map((a) => (
              <li
                key={a.id}
                aria-current={editingId === a.id ? 'true' : undefined}
                className={`rounded-md border px-3.5 py-3 transition-colors duration-(--duration-fast) ease-(--ease-out) ${
                  editingId === a.id ? 'border-primary bg-primary-soft' : 'border-border bg-surface'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-sm font-extrabold text-ink">
                    {a.label}
                    {a.isDefault && (
                      <StarIcon size={16} filled className="text-primary" title={t('addresses.defaultBadge')} />
                    )}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => startEdit(a)}>
                    {t('addresses.change')}
                  </Button>
                </div>
                <p className="mt-0.5 text-xs text-ink-soft">
                  {a.address}
                  {a.entrance && ` · под. ${a.entrance}`}
                  {a.floor && `, эт. ${a.floor}`}
                  {a.apartment && `, кв. ${a.apartment}`}
                </p>
              </li>
            ))}
          </ul>
          <Button variant="secondary" fullWidth icon={<PlusIcon size={18} />} onClick={startNew}>
            {t('addresses.addNew')}
          </Button>
        </div>

        <Card padding="lg" className="flex flex-col gap-3 lg:w-[420px]" as="section">
          <h2 className="text-sm font-extrabold text-ink">
            {editingId === 'new' ? t('addresses.addTitle') : t('addresses.editTitle')}
          </h2>
          <Input
            label={t('addresses.labelLabel')}
            required
            value={form.label}
            error={fieldErrors.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder={t('addresses.labelPlaceholder')}
          />
          <Input
            label={t('addresses.addressLabel')}
            required
            value={form.address}
            error={fieldErrors.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder={t('addresses.addressPlaceholder')}
          />
          <div className="grid grid-cols-3 gap-2">
            <Input
              label={t('addresses.entrance')}
              value={form.entrance}
              inputMode="numeric"
              onChange={(e) => setForm({ ...form, entrance: e.target.value })}
            />
            <Input
              label={t('addresses.floor')}
              value={form.floor}
              inputMode="numeric"
              onChange={(e) => setForm({ ...form, floor: e.target.value })}
            />
            <Input
              label={t('addresses.apartment')}
              value={form.apartment}
              inputMode="numeric"
              onChange={(e) => setForm({ ...form, apartment: e.target.value })}
            />
          </div>
          <Input
            label={t('addresses.commentLabel')}
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
            placeholder={t('addresses.commentPlaceholder')}
          />
          <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              className="size-4.5 accent-primary"
              checked={form.isDefault}
              onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
            />
            {t('addresses.setDefault')}
          </label>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button fullWidth loading={submitting} loadingLabel={t('common.saving')} onClick={save}>
            {t('addresses.save')}
          </Button>
          {editingId !== 'new' && editingId != null && (
            <Button variant="danger" fullWidth icon={<TrashIcon size={18} />} onClick={() => remove(editingId)}>
              {t('addresses.delete')}
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}
