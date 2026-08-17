'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import type { ComponentType } from 'react';
import {
  Alert,
  BellIcon,
  Button,
  CardIcon,
  Card,
  ChevronRightIcon,
  EditIcon,
  HelpIcon,
  IconButton,
  Input,
  LogoutIcon,
  MapPinIcon,
  WrenchIcon,
  type IconProps,
} from '@masterqala/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Me {
  name: string | null;
  phone: string;
  masterProfile: { blockedUntil: string | null } | null;
}

const PROFILE_ITEMS: { Icon: ComponentType<IconProps>; key: string; to: string }[] = [
  { Icon: MapPinIcon, key: 'addresses', to: '/addresses' },
  { Icon: CardIcon, key: 'payments', to: '/payments' },
  { Icon: BellIcon, key: 'notifications', to: '/notifications' },
  { Icon: HelpIcon, key: 'support', to: '/support' },
];

const LANGS = [
  { code: 'ru', label: 'Рус' },
  { code: 'kk', label: 'Қаз' },
  { code: 'en', label: 'Eng' },
] as const;

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    api('/users/me')
      .then((m: Me) => {
        setMe(m);
        setName(m.name ?? '');
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  async function saveName() {
    if (!name.trim()) {
      setNameError(t('profile.nameRequired'));
      return;
    }
    setNameError('');
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
    router.push('/login');
  }

  const blocked = me?.masterProfile?.blockedUntil && new Date(me.masterProfile.blockedUntil) > new Date();

  return (
    <div className="flex flex-col gap-4 px-5 py-6 sm:px-8">
      {/* Фиксированные w-[380px] + flex ломали страницу ниже 1100px. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="flex flex-col gap-3 lg:w-[380px] lg:shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-on-primary">
              {(me?.name || user?.phone || '?').slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="flex items-end gap-1.5">
                  <Input
                    label={t('profile.nameLabel')}
                    value={name}
                    error={nameError}
                    onChange={(e) => setName(e.target.value)}
                    fieldClassName="min-w-0 flex-1"
                    autoFocus
                  />
                  <Button size="sm" loading={saving} onClick={saveName} className="shrink-0">
                    {t('profile.save')}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="truncate text-lg font-extrabold text-ink">
                    {me?.name || t('profile.noName')}
                  </span>
                  <IconButton
                    label={t('profile.editName')}
                    icon={<EditIcon size={18} />}
                    onClick={() => setEditing(true)}
                  />
                </div>
              )}
              <p className="text-xs font-semibold text-ink-soft">{me?.phone ?? user?.phone}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('profile.languageLabel')}>
            {LANGS.map((l) => (
              <Button
                key={l.code}
                size="sm"
                variant={i18n.language === l.code ? 'primary' : 'secondary'}
                aria-pressed={i18n.language === l.code}
                onClick={() => i18n.changeLanguage(l.code)}
              >
                {l.label}
              </Button>
            ))}
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          {blocked && me?.masterProfile?.blockedUntil && (
            <Alert tone="warning">
              {t('profile.blockedUntil', {
                date: new Date(me.masterProfile.blockedUntil).toLocaleDateString('ru-RU'),
              })}
            </Alert>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3">
          {PROFILE_ITEMS.map(({ Icon, key, to }) => (
            <Link
              key={key}
              href={to}
              className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border bg-surface px-3.5 py-3.5 transition-colors duration-(--duration-fast) ease-(--ease-out) hover:bg-surface-sunken"
            >
              <span className="flex items-center gap-2 text-sm font-extrabold text-ink">
                <Icon size={20} className="text-primary" />
                {t(`profile.items.${key}`)}
              </span>
              <ChevronRightIcon size={18} className="shrink-0 text-ink-soft" />
            </Link>
          ))}
          <Card className="bg-surface-sunken">
            <p className="flex items-center gap-2 text-sm font-extrabold text-ink">
              <WrenchIcon size={20} className="text-primary" />
              {t('profile.becomeMasterTitle')}
            </p>
            <p className="mt-1 text-xs leading-relaxed font-semibold text-on-fill">
              {t('profile.becomeMasterSubtitle')}
            </p>
            <Link
              href="/become-master"
              className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-primary"
            >
              {t('profile.becomeMasterLink')}
              <ChevronRightIcon size={14} />
            </Link>
          </Card>
          <Link href="/wallet" className="text-center text-sm font-bold text-primary underline">
            {t('profile.wallet')}
          </Link>
          {user?.role === 'OPERATOR' && (
            <Link href="/admin" className="text-center text-sm font-bold text-primary underline">
              {t('profile.adminPanel')}
            </Link>
          )}
        </div>
      </div>
      <Button variant="secondary" fullWidth icon={<LogoutIcon size={18} />} onClick={doLogout}>
        {t('profile.logout')}
      </Button>
    </div>
  );
}
