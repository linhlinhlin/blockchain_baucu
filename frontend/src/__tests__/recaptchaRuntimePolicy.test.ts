import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('reCAPTCHA runtime policy', () => {
  test('is opt-in and requires a configured site key in the frontend', () => {
    const runtimeFlags = readFileSync(join(__dirname, '..', 'config', 'runtimeFlags.ts'), 'utf8');

    expect(runtimeFlags).toContain("recaptchaEnabledFlag === 'true'");
    expect(runtimeFlags).toContain('VITE_RECAPTCHA_SITE_KEY');
    expect(runtimeFlags).not.toContain("VITE_RECAPTCHA_ENABLED !== 'false'");
  });

  test('does not mount a second reCAPTCHA provider inside the register page', () => {
    const registerPage = readFileSync(join(__dirname, '..', 'pages', 'DangKyTaiKhoanPage.tsx'), 'utf8');

    expect(registerPage).not.toContain('GoogleReCaptchaProvider');
    expect(registerPage).toContain('isRecaptchaEnabled && <div id="recaptcha-container"');
  });
});
