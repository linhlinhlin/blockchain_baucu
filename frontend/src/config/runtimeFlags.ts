const recaptchaEnabledFlag = import.meta.env.VITE_RECAPTCHA_ENABLED;
const configuredRecaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim() ?? '';

export const recaptchaSiteKey =
  recaptchaEnabledFlag === 'true' ? configuredRecaptchaSiteKey : '';
export const isRecaptchaEnabled = recaptchaEnabledFlag === 'true' && recaptchaSiteKey.length > 0;
