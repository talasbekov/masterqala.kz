import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import {
  Alert,
  BellIcon,
  Button,
  Card,
  ChevronRightIcon,
  HelpIcon,
  Input,
  MapPinIcon,
  CardIcon,
  ChevronRightIcon as ArrowIcon,
  WrenchIcon,
} from '@masterqala/ui';
import { useAuth } from '../../../auth';

interface Me {
  name: string | null;
  phone: string;
  masterProfile: { blockedUntil: string | null } | null;
}

const PROFILE_ITEMS = [
  { icon: <MapPinIcon size={18} />, key: 'addresses', to: '/profile/addresses' },
  { icon: <CardIcon size={18} />, key: 'payments', to: '/profile/payments' },
  { icon: <BellIcon size={18} />, key: 'notifications', to: '/notifications' },
  { icon: <HelpIcon size={18} />, key: 'support', to: '/support' },
] as const;

const LANGS = [
  { code: 'ru', label: 'Рус' },
  { code: 'kk', label: 'Қаз' },
  { code: 'en', label: 'Eng' },
] as const;

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/users/me')
      .then((m: Me) => {
        setMe(m);
        setName(m.name ?? '');
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  async function saveName() {
    setSaving(true);
    setError('');
    try {
      const updated = await api('/users/me', { method: 'PATCH', body: JSON.stringify({ name }) });
      setMe(updated);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function doLogout() {
    logout();
    navigate('/login');
  }

  const blocked = me?.masterProfile?.blockedUntil && new Date(me.masterProfile.blockedUntil) > new Date();

  return (
    <div className="flex flex-col gap-3 px-5 pb-3.5 pt-1.5">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-on-primary">
          {(me?.name || user?.phone || '?').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-end gap-1.5">
              <Input
                label={t('profile.noName')}
                labelHidden
                fieldClassName="min-w-0 flex-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoFocus
              />
              <Button variant="ghost" size="sm" loading={saving} onClick={saveName}>
                {t('profile.save')}
              </Button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="block min-h-11 text-left">
              <span className="text-lg font-extrabold text-ink">{me?.name || t('profile.noName')}</span>
              <span className="ml-1.5 text-xs font-bold text-primary">{t('profile.editName')}</span>
            </button>
          )}
          <div className="text-xs font-semibold text-ink-soft">{me?.phone ?? user?.phone}</div>
        </div>
      </div>
      <div className="flex gap-1.5">
        {LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => i18n.changeLanguage(l.code)}
            aria-pressed={i18n.language === l.code}
            className={`min-h-11 rounded-pill border px-3.5 py-1.5 text-xs font-extrabold ${
              i18n.language === l.code
                ? 'border-primary bg-primary text-on-primary'
                : 'border-border-strong text-ink-soft'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
      {blocked && me?.masterProfile?.blockedUntil && (
        <Alert tone="warning">
          {t('profile.blockedUntil', { date: new Date(me.masterProfile.blockedUntil).toLocaleDateString('ru-RU') })}
        </Alert>
      )}
      {PROFILE_ITEMS.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          className="flex min-h-11 items-center justify-between rounded-md border border-border bg-surface px-3.5 py-3.5"
        >
          <span className="inline-flex items-center gap-2 text-sm font-extrabold text-ink">
            <span className="shrink-0 text-primary">{item.icon}</span>
            {t(`profile.items.${item.key}`)}
          </span>
          <ChevronRightIcon size={18} className="shrink-0 text-ink-soft" />
        </Link>
      ))}
      <Card className="bg-fill" padding="sm">
        <div className="inline-flex items-center gap-2 text-sm font-extrabold text-ink">
          <WrenchIcon size={18} className="text-primary" />
          {t('profile.becomeMasterTitle')}
        </div>
        <div className="mt-1 text-xs font-semibold leading-relaxed text-on-fill">{t('profile.becomeMasterSubtitle')}</div>
        <Link
          to="/become-master"
          className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-extrabold text-primary"
        >
          {t('profile.becomeMasterLink')}
          <ArrowIcon size={16} />
        </Link>
      </Card>
      <Link to="/wallet" className="min-h-11 py-2.5 text-center text-sm font-bold text-primary underline">
        {t('profile.wallet')}
      </Link>
      {user?.role === 'OPERATOR' && (
        <Link to="/admin" className="min-h-11 py-2.5 text-center text-sm font-bold text-primary underline">
          {t('profile.adminPanel')}
        </Link>
      )}
      <Button variant="ghost" fullWidth className="text-danger" onClick={doLogout}>
        {t('profile.logout')}
      </Button>
    </div>
  );
}
