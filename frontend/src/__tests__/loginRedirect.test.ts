import {
  DEFAULT_LOGIN_REDIRECT,
  buildLoginRedirectPath,
  normalizeLoginRedirect,
} from '../utils/loginRedirect';

describe('login redirect helpers', () => {
  test('falls back when redirect is missing or unsafe', () => {
    expect(normalizeLoginRedirect(null)).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(normalizeLoginRedirect('')).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(normalizeLoginRedirect('https://evil.example/app')).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(normalizeLoginRedirect('//evil.example/app')).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(normalizeLoginRedirect('/\\evil')).toBe(DEFAULT_LOGIN_REDIRECT);
  });

  test('keeps internal paths with query and hash intact', () => {
    expect(normalizeLoginRedirect('/app/verify-voter?token=a%2Fb#step-2')).toBe(
      '/app/verify-voter?token=a%2Fb#step-2',
    );
  });

  test('accepts one encoded internal redirect value', () => {
    expect(normalizeLoginRedirect('%2Fapp%2Fverify-voter%3Ftoken%3Da%252Fb')).toBe(
      '/app/verify-voter?token=a%2Fb',
    );
  });

  test('builds login URL without dropping current query', () => {
    expect(buildLoginRedirectPath('/app/verify-voter', '?token=abc&group=1')).toBe(
      `/login?redirectTo=${encodeURIComponent('/app/verify-voter?token=abc&group=1')}`,
    );
  });
});
