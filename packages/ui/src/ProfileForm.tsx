'use client';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { TextField } from './TextField';
function maskedPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('7') ? `+7 ${digits.slice(1, 4)} *** ** ${digits.slice(-2)}` : phone;
}
export function ProfileForm({ name, phone, loading, saving, error, onName, onSave, languageControl, t }: {
  t: (key: string) => string; name: string; phone: string; loading: boolean; saving: boolean; error: string;
  onName: (name: string) => void; onSave: () => void; languageControl: ReactNode;
}) {
  return <form className="mq-profile-form" aria-busy={loading || saving || undefined}
    onSubmit={event => { event.preventDefault(); if (!loading && !saving) onSave(); }}>
    <h2>{t('profile.personalTitle')}</h2>
    <TextField label={t('profile.nameLabel')} name="name" value={name} onChange={event => onName(event.target.value)}
      autoComplete="name" maxLength={100} fullWidth variant="responsive" disabled={loading || saving} />
    <TextField label={t('profile.phoneLabel')} name="phone" value={maskedPhone(phone)} readOnly fullWidth variant="responsive" />
    {languageControl}
    {error && <p className="mq-profile-error" role="alert">{error}</p>}
    <Button className="min-h-[56px] md:min-h-[52px]" type="submit" fullWidth loading={saving} loadingLabel={t('profile.saving')} disabled={loading}>{t('profile.save')}</Button>
  </form>;
}
