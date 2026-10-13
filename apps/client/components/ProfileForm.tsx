'use client';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, TextField } from '@masterqala/ui';
function maskedPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('7') ? `+7 ${digits.slice(1, 4)} *** ** ${digits.slice(-2)}` : phone;
}
export function ProfileForm({ name, phone, loading, saving, error, onName, onSave, languageControl }: {
  name: string; phone: string; loading: boolean; saving: boolean; error: string;
  onName: (name: string) => void; onSave: () => void; languageControl: ReactNode;
}) {
  const { t } = useTranslation();
  return <form className="mq-profile-form" aria-busy={loading || saving || undefined}
    onSubmit={event => { event.preventDefault(); if (!loading && !saving) onSave(); }}>
    <h2>{t('profile.personalTitle')}</h2>
    <TextField label={t('profile.nameLabel')} name="name" value={name} onChange={event => onName(event.target.value)}
      autoComplete="name" maxLength={100} fullWidth variant="responsive" disabled={loading || saving} />
    <TextField label={t('profile.phoneLabel')} name="phone" value={maskedPhone(phone)} readOnly fullWidth variant="responsive" />
    {languageControl}
    {error && <p className="mq-profile-error" role="alert">{error}</p>}
    <Button type="submit" fullWidth loading={saving} loadingLabel={t('profile.saving')} disabled={loading}>{t('profile.save')}</Button>
  </form>;
}
