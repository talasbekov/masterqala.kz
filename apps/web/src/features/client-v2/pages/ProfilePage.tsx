import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../../api';
import { useAuth } from '../../../auth';

interface Me {
  name: string | null;
  phone: string;
  masterProfile: { blockedUntil: string | null } | null;
}

const PROFILE_ITEMS = [
  { icon: '📍', key: 'addresses', to: '/profile/addresses' },
  { icon: '💳', key: 'payments', to: '/profile/payments' },
  { icon: '🔔', key: 'notifications', to: '/notifications' },
  { icon: '🛟', key: 'support', to: '/support' },
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
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-c2-primary text-lg font-extrabold text-white">
          {(me?.name || user?.phone || '?').slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-0 flex-1 rounded-c2-md border-[1.5px] border-c2-border bg-c2-surface px-2.5 py-1.5 text-sm font-extrabold text-c2-ink outline-none"
                autoFocus
              />
              <button type="button" onClick={saveName} disabled={saving} className="shrink-0 text-sm font-extrabold text-c2-primary">
                {t('profile.save')}
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="block text-left">
              <span className="text-lg font-extrabold text-c2-ink">{me?.name || t('profile.noName')}</span>
              <span className="ml-1.5 text-xs font-bold text-c2-primary">{t('profile.editName')}</span>
            </button>
          )}
          <div className="text-xs font-semibold text-c2-ink-soft">{me?.phone ?? user?.phone}</div>
        </div>
      </div>
      <div className="flex gap-1.5">
        {LANGS.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => i18n.changeLanguage(l.code)}
            className={`rounded-c2-pill border-[1.5px] px-3.5 py-1.5 text-xs font-extrabold ${
              i18n.language === l.code ? 'border-c2-primary bg-c2-primary text-white' : 'border-c2-border text-c2-ink-soft'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm font-semibold text-c2-danger">{error}</p>}
      {blocked && me?.masterProfile?.blockedUntil && (
        <div className="rounded-c2-md bg-c2-danger-bg p-3 text-xs font-semibold text-c2-danger-ink">
          {t('profile.blockedUntil', { date: new Date(me.masterProfile.blockedUntil).toLocaleDateString('ru-RU') })}
        </div>
      )}
      {PROFILE_ITEMS.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          className="flex items-center justify-between rounded-c2-md border border-c2-border bg-c2-surface px-3.5 py-3.5"
        >
          <span className="text-sm font-extrabold text-c2-ink">
            {item.icon} {t(`profile.items.${item.key}`)}
          </span>
          <span className="text-c2-ink-soft">›</span>
        </Link>
      ))}
      <div className="rounded-c2-lg bg-c2-fill p-3.5">
        <div className="text-sm font-extrabold text-c2-ink">🔧 {t('profile.becomeMasterTitle')}</div>
        <div className="mt-1 text-xs font-semibold leading-relaxed text-c2-on-fill">{t('profile.becomeMasterSubtitle')}</div>
        <Link to="/become-master" className="mt-2 inline-block text-xs font-extrabold text-c2-primary">
          {t('profile.becomeMasterLink')} →
        </Link>
      </div>
      <Link to="/wallet" className="text-center text-sm font-bold text-c2-primary underline">
        {t('profile.wallet')}
      </Link>
      {user?.role === 'OPERATOR' && (
        <Link to="/admin" className="text-center text-sm font-bold text-c2-primary underline">
          {t('profile.adminPanel')}
        </Link>
      )}
      <button type="button" onClick={doLogout} className="p-2 text-center text-[13.5px] font-extrabold text-c2-danger">
        {t('profile.logout')}
      </button>
    </div>
  );
}
