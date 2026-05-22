import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('MetaMask login nonce policy', () => {
  test('requests login challenge from the backend instead of building one in the browser', () => {
    const loginPage = readFileSync(join(__dirname, '..', 'pages', 'LoginPage.tsx'), 'utf8');
    const authApi = readFileSync(join(__dirname, '..', 'api', 'dangNhapTaiKhoanApi.tsx'), 'utf8');

    expect(loginPage).toContain('layMetaMaskLoginChallenge');
    expect(authApi).toContain('/login-metamask/nonce');
    expect(loginPage).not.toContain('Math.random().toString(36)');
    expect(loginPage).not.toContain('HoLiHu BlockVote Login\\nAddress');
  });
});
