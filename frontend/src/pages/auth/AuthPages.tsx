import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, Check, Loader2, Shield, Sparkles, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { onboardingInterestOptions, onboardingRecommendations } from '../../features/onboarding/options';
import { SwipeInterestPicker } from '../../features/onboarding/SwipeInterestPicker';
import { api, getApiErrorMessage } from '../../shared/api/client';
import { Avatar, Button, Input } from '../../shared/ui';
import { useAuthStore } from '../../store/authStore';
import { safeRedirectTo } from '../../utils/authRedirect';
import { useTranslation } from '../../shared/i18n';
import { trackEvent } from '../../shared/lib/analytics';

export function LoginPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirectTo(searchParams.get('redirect_to'));
  const error = searchParams.get('error');
  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [navigate, redirectTo, user]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] p-4 dark:bg-zinc-950">
      <section className="w-full max-w-md space-y-6 rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <Link to="/" className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-[#FF6B00] text-3xl font-black text-white">М</Link>
        <div>
          <h1 className="text-4xl font-black">{t('common.site_name')}</h1>
          <p className="mt-2 text-gray-500">{t('app.welcome')}</p>
        </div>
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {t('app.login_error')}
          </div>
        ) : null}
        <a
          href={api.telegramStartUrl(redirectTo)}
          className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-[#2AABEE] px-4 text-sm font-black text-white transition-colors hover:bg-[#229ED9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2AABEE]/40"
        >
          {t('app.continue_telegram')}
        </a>
        <p className="text-xs text-gray-500">
          {t('app.no_telegram')}
        </p>
      </section>
    </div>
  );
}

type AuthStep = 'token' | 'profile' | 'ready' | 'error';

export function AuthCallbackPage() {
  const { checkAuth } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [step, setStep] = useState<AuthStep>('token');
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace('#', '?'));
    const search = new URLSearchParams(window.location.search);
    const token = hash.get('token') || search.get('token');
    const redirectTo = hash.get('redirect_to') || search.get('redirect_to') || '/';
    if (!token) {
      setStep('error');
      return;
    }
    localStorage.setItem('auth_token', token);
    setStep('profile');
    checkAuth()
      .then(() => {
        setStep('ready');
        // Give the user a beat to see the "ready" state
        window.setTimeout(() => navigate(safeRedirectTo(redirectTo), { replace: true }), 350);
      })
      .catch(() => {
        localStorage.removeItem('auth_token');
        setStep('error');
      });
  }, [checkAuth, navigate, t]);

  const steps: Array<{ key: AuthStep; label: string }> = [
    { key: 'token', label: t('app.auth_step_token') },
    { key: 'profile', label: t('app.auth_step_profile') },
    { key: 'ready', label: t('app.auth_step_ready') },
  ];
  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] p-4 dark:bg-zinc-950">
      <section className="w-full max-w-md space-y-6 rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950" role="status" aria-live="polite">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg bg-[#FF6B00] text-3xl font-black text-white">М</div>
        {step === 'error' ? (
          <>
            <p className="text-base font-black text-red-600 dark:text-red-400">{t('app.session_failed')}</p>
            <a
              href="/login"
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#FF6B00] text-sm font-black text-white transition-colors hover:bg-orange-600"
            >
              {t('app.auth_back_to_login')}
            </a>
          </>
        ) : (
          <>
            <div className="space-y-2">
              {steps.map((s, i) => {
                const isDone = currentIndex > i || step === 'ready';
                const isActive = currentIndex === i;
                return (
                  <div key={s.key} className="flex items-center gap-3 text-left">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black transition-colors ${
                      isDone ? 'bg-green-500 text-white'
                        : isActive ? 'bg-[#FF6B00] text-white'
                        : 'bg-gray-100 text-gray-400 dark:bg-zinc-900 dark:text-zinc-600'
                    }`}>
                      {isDone ? <Check size={14} /> : isActive ? <Loader2 size={14} className="animate-spin" /> : i + 1}
                    </div>
                    <span className={`text-sm font-black transition-colors ${
                      isDone || isActive ? 'text-gray-900 dark:text-zinc-100' : 'text-gray-400 dark:text-zinc-600'
                    }`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-900">
              <div
                className="h-full bg-[#FF6B00] transition-all duration-500"
                style={{ width: `${Math.max(0, ((currentIndex + 1) / steps.length) * 100)}%` }}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function AdminLoginPage() {
  const { adminLogin } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => { document.head.removeChild(meta); };
  }, []);
  const submit = async () => {
    setError('');
    if (!login.trim()) {
      setError(t('app.admin_login'));
      return;
    }
    if (!password) {
      setError(t('app.admin_password'));
      return;
    }
    try {
      await adminLogin({ login: login.trim(), password });
      navigate('/admin');
    } catch (event) {
      setError(getApiErrorMessage(event, t('app.admin_login_error')));
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] p-4 dark:bg-zinc-950">
      <section className="w-full max-w-md space-y-4 rounded-lg border border-gray-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <Shield className="text-[#FF6B00]" size={36} />
        <h1 className="text-3xl font-black">{t('app.admin_panel')}</h1>
        <Input value={login} onChange={(event) => setLogin(event.target.value)} placeholder={t('app.login')} />
        <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('app.password')} type="password" error={error} />
        <Button onClick={submit} className="w-full">{t('nav.login')}</Button>
      </section>
    </div>
  );
}

export function OnboardingPage() {
  const { user, updateProfile } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [step, setStep] = useState<'interests' | 'communities' | 'profile'>('interests');
  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [interests, setInterests] = useState<string[]>(user?.interests?.length ? user.interests : []);
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [error, setError] = useState('');
  const communitiesQuery = useQuery({
    queryKey: ['communities', 'onboarding'],
    queryFn: () => api.communities(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  const submit = async () => {
    setError('');
    try {
      await updateProfile({
        username: username.replace(/^@/, '').trim(),
        display_name: displayName.trim(),
        avatar_url: avatarUrl.trim() || undefined,
        interests,
        onboarding_completed: true,
      });
      await Promise.allSettled(selectedCommunities.map((slug) => api.joinCommunity(slug, false)));
      trackEvent('onboarding_completed', {
        interests_count: interests.length,
        communities_count: selectedCommunities.length,
      });
      navigate('/?compose=1&onboarded=1');
    } catch (event) {
      setError(getApiErrorMessage(event, t('app.finish_error')));
    }
  };
  const toggleCommunity = (slug: string) => {
    setSelectedCommunities((current) => current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]);
  };
  const handleAvatarUpload = async (file?: File) => {
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError('');
    try {
      const next = await api.uploadAvatar(file);
      setAvatarUrl(next.avatar_url || '');
    } catch {
      setAvatarError(t('upload.avatar_error'));
    } finally {
      setAvatarUploading(false);
    }
  };
  const recommendedCommunities = (communitiesQuery.data || []).slice(0, 6);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] p-4 dark:bg-zinc-950">
      <section className="w-full max-w-3xl space-y-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
        <div>
          <h1 className="text-3xl font-black">{t('onboarding.title')}</h1>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs font-black">
            {[
              ['interests', 'Интересы'],
              ['communities', 'Сообщества'],
              ['profile', 'Профиль'],
            ].map(([id, label]) => (
              <div key={id} className={`rounded-lg px-3 py-2 text-center ${step === id ? 'bg-[#FF6B00] text-white' : 'bg-gray-100 text-gray-500 dark:bg-zinc-900 dark:text-zinc-400'}`}>
                {label}
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm font-bold text-gray-500">
            {step === 'interests'
              ? t('onboarding.swipe_hint')
              : step === 'communities'
                ? 'Выберите сообщества, чтобы первая лента сразу получила живой контекст.'
                : t('onboarding.last_step')}
          </p>
        </div>

        {step === 'interests' ? (
          <>
            <SwipeInterestPicker
              options={onboardingInterestOptions}
              selected={interests}
              onChange={setInterests}
              onComplete={() => setStep('communities')}
            />
            <Button
              onClick={() => setStep('communities')}
              className="w-full"
              disabled={interests.length === 0}
            >
              {t('app.next_selected', { count: interests.length })}
            </Button>
          </>
        ) : step === 'communities' ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {communitiesQuery.isLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-900" />
                ))
              ) : recommendedCommunities.length ? recommendedCommunities.map((community) => {
                const selected = selectedCommunities.includes(community.slug);
                return (
                  <button
                    key={community.id}
                    type="button"
                    onClick={() => toggleCommunity(community.slug)}
                    className={`flex gap-3 rounded-lg border p-4 text-left transition-all ${
                      selected
                        ? 'border-[#FF6B00] bg-orange-50 ring-2 ring-orange-100 dark:bg-orange-950/20 dark:ring-orange-950'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-purple-100 text-purple-600">
                      {community.avatar_url ? <img src={community.avatar_url} alt="" className="h-full w-full object-cover" /> : <Users size={20} />}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-black">{community.name}</span>
                      <span className="line-clamp-2 text-sm text-gray-500 dark:text-zinc-400">{community.description}</span>
                      <span className="mt-1 block text-xs font-bold text-gray-400">{community.members_count} участников</span>
                    </span>
                    {selected ? <Check size={18} className="text-[#FF6B00]" /> : null}
                  </button>
                );
              }) : (
                <div className="sm:col-span-2 rounded-lg border border-dashed border-gray-200 p-6 text-center dark:border-zinc-800">
                  <Sparkles className="mx-auto mb-2 text-[#FF6B00]" />
                  <p className="font-black">Сообщества появятся в рекомендациях после первых публикаций.</p>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('interests')}>{t('app.prev')}</Button>
              <Button onClick={() => setStep('profile')} className="flex-1">
                {selectedCommunities.length ? `Далее (${selectedCommunities.length} выбрано)` : 'Пропустить и продолжить'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="@nickname" error={error} />
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t('app.name')} />
              <div className="sm:col-span-2">
                <label className="group/avatar relative flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 transition-colors hover:border-orange-300 hover:bg-orange-50 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-orange-950/20">
                  <Avatar src={avatarUrl} name={displayName || user?.display_name} className="h-14 w-14 rounded-xl" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-700 dark:text-zinc-200">
                      {avatarUploading ? t('common.loading') : avatarUrl ? t('common.update') : t('onboarding.upload_avatar')}
                    </p>
                    <p className="text-xs text-gray-400">JPG, PNG, WebP</p>
                  </div>
                  {avatarUploading && <Loader2 size={18} className="animate-spin text-gray-400" />}
                  {!avatarUploading && <Camera size={18} className="text-gray-400 opacity-0 transition-opacity group-hover/avatar:opacity-100" />}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={avatarUploading}
                    onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
                  />
                </label>
                {avatarError ? <p className="mt-1 text-xs font-bold text-red-500">{avatarError}</p> : null}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[...onboardingRecommendations, { title: 'Первый мем', description: 'После завершения откроется форма публикации.' }].map((item) => (
                <article key={item.title} className="rounded-lg border border-gray-200 p-4 dark:border-zinc-800">
                  <h2 className="font-black">{item.title}</h2>
                  <p className="mt-1 text-sm font-medium text-gray-500">{item.description}</p>
                </article>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('communities')}>{t('app.prev')}</Button>
              <Button onClick={submit} className="flex-1" disabled={!username.trim() || !displayName.trim() || interests.length === 0}>{t('app.finish')}</Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
