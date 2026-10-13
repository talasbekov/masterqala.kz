'use client';
import { useTranslation } from 'react-i18next';
import { Button, TextField } from '@masterqala/ui';
export interface AddressFormValue {
  label: string; address: string; entrance: string; floor: string; apartment: string; comment: string; isDefault: boolean;
}
export function AddressEditor({ value, onChange, isNew, submitting, error, onSave, onDelete }: {
  value: AddressFormValue; onChange: (value: AddressFormValue) => void; isNew: boolean;
  submitting: boolean; error: string; onSave: () => void; onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const field = (name: 'label' | 'address' | 'entrance' | 'floor' | 'apartment' | 'comment', label: string, placeholder?: string) =>
    <TextField key={name} name={name} label={label} placeholder={placeholder} value={value[name]} fullWidth variant="responsive"
      disabled={submitting} onChange={event => onChange({ ...value, [name]: event.target.value })} />;
  return <form className="mq-address-editor" onSubmit={event => { event.preventDefault(); if (!submitting && value.label && value.address) onSave(); }}>
    <h2>{t(isNew ? 'addresses.addTitle' : 'addresses.editTitle')}</h2>
    {field('label', t('addresses.label'), t('addresses.labelPlaceholder'))}
    {field('address', t('addresses.addressLabel'), t('addresses.addressPlaceholder'))}
    <div className="mq-address-details">
      {field('entrance', t('addresses.entrance'))}
      {field('floor', t('addresses.floor'))}
      {field('apartment', t('addresses.apartment'))}
    </div>
    {field('comment', t('addresses.commentLabel'), t('addresses.commentPlaceholder'))}
    <label className="mq-address-default"><input type="checkbox" name="isDefault" checked={value.isDefault} disabled={submitting}
      onChange={event => onChange({ ...value, isDefault: event.target.checked })} />{t('addresses.setDefault')}</label>
    {error && <p className="mq-address-error" role="alert">{error}</p>}
    <Button type="submit" fullWidth loading={submitting} loadingLabel={t('addresses.saving')}
      disabled={!value.label || !value.address}>{t('addresses.save')}</Button>
    {onDelete && <Button variant="danger" fullWidth disabled={submitting} onClick={onDelete}>{t('addresses.delete')}</Button>}
  </form>;
}


export function AddressDetails({ entrance, floor, apartment }: { entrance?: string | null; floor?: string | null; apartment?: string | null }) {
  const { t } = useTranslation();
  const details = [[entrance, 'entranceShort'], [floor, 'floorShort'], [apartment, 'apartmentShort']]
    .filter(([value]) => Boolean(value)).map(([value, label]) => `${t(`addresses.${label}`)} ${value}`);
  return <>{details.length > 0 ? ` · ${details.join(', ')}` : ''}</>;
}
