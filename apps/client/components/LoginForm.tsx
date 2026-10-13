'use client';
import { useTranslation } from 'react-i18next';
import { Button, CodeInput, TextField } from '@masterqala/ui';
export type LoginPendingAction = 'send' | 'resend' | 'verify' | null;
export interface LoginFormProps {
  step: 'phone' | 'sms'; phone: string; code: string; error: string; pendingAction: LoginPendingAction; resendIn: number;
  onPhone: (phone: string) => void; onCode: (code: string) => void; onRequest: () => void; onVerify: () => void; onChangeNumber: () => void;
}
export function LoginForm({ step, phone, code, error, pendingAction, resendIn, onPhone, onCode, onRequest, onVerify, onChangeNumber }: LoginFormProps) {
  const { t } = useTranslation();
  const submitting = pendingAction !== null;
  const national = phone.replace(/\D/g, '').slice(-10);
  const formattedPhone = national.length === 10 ? `+7 ${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 8)} ${national.slice(8)}` : `+7 ${phone}`;
  const maskedPhone = national.length === 10 ? `+7 ${national.slice(0, 3)} *** ** ${national.slice(8)}` : '+7';
  const phoneValid = phone.replace(/\D/g, '').length >= 10;
  const codeValid = /^\d{6}$/.test(code);
  const time = `${Math.floor(resendIn / 60)}:${String(resendIn % 60).padStart(2, '0')}`;
  return <form data-step={step} className="mq-login-form" onSubmit={event => {
    event.preventDefault();
    if (submitting) return;
    if (step === 'phone' && phoneValid) onRequest();
    if (step === 'sms' && codeValid) onVerify();
  }}>
    <h2>{t(step === 'phone' ? 'auth.phonePanelTitle' : 'auth.confirmTitle')}</h2>
    {step === 'phone' ? <>
      <TextField label={t('auth.phoneLabel')} leadingText="+7" name="phone" type="tel" inputMode="tel" autoComplete="tel-national"
        autoFocus variant="responsive" fullWidth value={phone} disabled={submitting} placeholder={t('auth.phonePlaceholder')}
        onChange={event => onPhone(event.target.value)} error={error || undefined} />
      <p className="mq-login-country">{t('auth.country')}</p>
      <p className="mq-login-explainer">{t('auth.phoneSubtitle')}</p>
      <section className="mq-login-account-note"><h3>{t('auth.accountTitle')}</h3><p>{t('auth.accountDescription')}</p></section>
      <div className="mq-login-actions"><Button type="submit" fullWidth loading={pendingAction === 'send'} loadingLabel={t('auth.requesting')}
        disabled={submitting || !phoneValid}>{t('auth.getCodeButton')}</Button></div>
      <p className="mq-login-terms">{t('auth.termsPrefix')} {t('auth.termsLink')}</p>
    </> : <>
      <p className="mq-login-sms-web">{t('auth.smsSubtitle', { phone: formattedPhone })}</p><p className="mq-login-sms-mobile">{t('auth.smsSubtitle', { phone: maskedPhone })}</p>
      <CodeInput label={t('auth.codeLabel')} name="code" autoFocus value={code} onChange={onCode} error={error || undefined} disabled={submitting} />
      <Button variant="secondary" fullWidth data-resend loading={pendingAction === 'resend'} loadingLabel={t('auth.requesting')} disabled={resendIn > 0 || submitting} onClick={() => { if (resendIn <= 0 && !submitting) onRequest(); }}>
        {resendIn > 0 ? t('auth.resendIn', { time }) : t('auth.resendNow')}
      </Button>
      <p>{t('auth.codeHelp')}</p>
      <div className="mq-login-actions">
        <Button type="submit" fullWidth loading={pendingAction === 'verify'} loadingLabel={t('auth.verifying')} disabled={submitting || !codeValid}>{t('auth.loginButton')}</Button>
        <Button variant="secondary" fullWidth data-change-number disabled={submitting} onClick={onChangeNumber}>{t('auth.changeNumber')}</Button>
      </div>
    </>}
  </form>;
}
