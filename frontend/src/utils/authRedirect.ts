export function safeRedirectTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\n') || value.includes('\r')) {
    return '/';
  }
  return value;
}

export function currentRedirectTarget(): string {
  return safeRedirectTo(`${window.location.pathname}${window.location.search}${window.location.hash}`);
}

export function authRedirectUrl(redirectTo = currentRedirectTarget()): string {
  return `/login?redirect_to=${encodeURIComponent(safeRedirectTo(redirectTo))}`;
}

export function redirectToLogin(redirectTo?: string): void {
  window.location.href = authRedirectUrl(redirectTo);
}
