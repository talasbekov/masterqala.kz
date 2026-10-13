const ROUTES = new Set(['', 'catalog', 'orders', 'order', 'planned', 'profile', 'addresses', 'payments', 'notifications', 'support']);
/** Only existing same-origin client routes may resume after authentication. */
export function safeReturnPath(candidate: string | null): string {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(candidate)) return '/';
  try {
    const url = new URL(candidate, 'https://masterqala.local');
    const decodedPath = decodeURIComponent(url.pathname);
    if (url.origin !== 'https://masterqala.local' || decodedPath.startsWith('//') || decodedPath.includes('\\') || /[\u0000-\u0020\u007f]/.test(decodedPath) || !ROUTES.has(decodedPath.split('/')[1])) return '/';
    return url.pathname + url.search + url.hash;
  } catch { return '/'; }
}
export function protectedLoginUrl(pathname: string, search = ''): string {
  const target = safeReturnPath(pathname + (search ? `?${search}` : ''));
  return `/login?${new URLSearchParams({ returnTo: target })}`;
}
