export const DEFAULT_LOGIN_REDIRECT = '/app';

export const buildLoginRedirectPath = (pathname: string, search = '', hash = '') => {
  const target = `${pathname || '/'}${search}${hash}`;
  return `/login?redirectTo=${encodeURIComponent(target)}`;
};

const decodeIfNeeded = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('/')) {
    return trimmed;
  }

  try {
    return decodeURIComponent(trimmed);
  } catch {
    return '';
  }
};

export const normalizeLoginRedirect = (
  redirectTo: string | null | undefined,
  fallback = DEFAULT_LOGIN_REDIRECT,
) => {
  if (!redirectTo) {
    return fallback;
  }

  const candidate = decodeIfNeeded(redirectTo).trim();
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }

  if (candidate.includes('\\')) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, 'https://local.holihu');
    if (parsed.origin !== 'https://local.holihu') {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
};
