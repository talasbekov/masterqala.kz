'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ProfileForm } from '@/components/ProfileForm';
import { LanguageControl } from '@/components/LanguageControl';

interface Me {
  name: string | null;
  phone: string;
  masterProfile: { blockedUntil: string | null } | null;
}

const PROFILE_ITEMS = [
  { icon: '📍', key: 'addresses', to: '/addresses' },
  { icon: '💳', key: 'payments', to: '/payments' },
  { icon: '🔔', key: 'notifications', to: '/notifications' },
  { icon: '🛟', key: 'support', to: '/support' },
] as const;

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
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
      setName(updated.name ?? '');
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
    <div className="mq-profile-page">
      <h1>{t('profile.title')}</h1>
      <p className="mq-profile-subtitle">{t('profile.subtitle')}</p>
      <div className="mq-profile-columns">
        <div className="mq-profile-personal">
          <ProfileForm name={name} phone={me?.phone ?? user?.phone ?? ''} loading={!me && !error} saving={saving}
            error={error} onName={setName} onSave={saveName} languageControl={<LanguageControl variant="profile" />} />
          {blocked && me?.masterProfile?.blockedUntil && (
            <div className="rounded-md bg-danger-bg p-3 text-xs font-semibold text-danger-ink">
              {t('profile.blockedUntil', { date: new Date(me.masterProfile.blockedUntil).toLocaleDateString(i18n.language === 'kk' ? 'kk-KZ' : i18n.language === 'en' ? 'en-GB' : 'ru-RU') })}
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3">
          {PROFILE_ITEMS.map((item) => (
            <Link
              key={item.key}
              href={item.to}
              className="flex items-center justify-between rounded-md border border-border bg-surface px-3.5 py-3.5"
            >
              <span className="text-sm font-extrabold text-ink">
                {item.icon} {t(`profile.items.${item.key}`)}
              </span>
              <span className="text-ink-soft">›</span>
            </Link>
          ))}
          <div className="rounded-lg bg-fill p-3.5">
            <div className="text-sm font-extrabold text-ink">🔧 {t('profile.becomeMasterTitle')}</div>
            <div className="mt-1 text-xs font-semibold leading-relaxed text-on-fill">{t('profile.becomeMasterSubtitle')}</div>
            <Link href="/become-master" className="mt-2 inline-block text-xs font-extrabold text-primary">
              {t('profile.becomeMasterLink')} →
            </Link>
          </div>
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
      <button
        type="button"
        onClick={doLogout}
        className="rounded-pill border-[1.5px] border-danger p-3 text-center text-[13.5px] font-extrabold text-danger"
      >
        {t('profile.logout')}
      </button>
    </div>
  );
}
