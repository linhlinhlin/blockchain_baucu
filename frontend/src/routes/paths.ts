// Đợt 14 — Nguồn sự thật cho đường dẫn (canonical EN, kebab-case, REST-ish).
// Path VN cũ giữ làm `legacy` để Navigate redirect; KHÔNG dùng để Link mới.
// Chuẩn theo Stripe/Vercel/GitHub: path tiếng Anh nhất quán, UI tiếng Việt.

export const PATHS = {
  // Public
  home: '/',
  login: '/login',
  register: '/register',
  publicElections: '/elections',
  forgotPassword: '/forgot-password',
  forgotPasswordOptions: (u: string, c: string) =>
    `/forgot-password/account/${encodeURIComponent(u)}/${encodeURIComponent(c)}/options`,
  forgotPasswordSendOtp: (u: string, c: string) =>
    `/forgot-password/account/${encodeURIComponent(u)}/${encodeURIComponent(c)}/send-otp`,
  forgotPasswordReset: (u: string, c: string) =>
    `/forgot-password/account/${encodeURIComponent(u)}/${encodeURIComponent(c)}/reset`,
  unauthorized: '/unauthorized',
  privacy: '/privacy',
  terms: '/terms',
  faq: '/faq',
  contact: '/contact',
  thanks: '/thanks',
  blockchainSetup: '/blockchain-setup',
  verifyVoter: '/verify-voter',

  // App (post-login)
  app: '/app',
  dashboard: '/app/dashboard', // smart-contract console
  elections: '/app/elections', // user's election list
  electionsNew: '/app/elections/new', // create
  notifications: '/app/notifications',
  files: '/app/files',
  scan: '/app/scan',
  account: '/app/account',
  settings: '/app/settings',
  admin: '/app/admin',
  adminRoles: '/app/admin/roles',
  adminPermissions: '/app/admin/permissions',
} as const;

// Path VN/cũ → canonical mới (để Navigate redirect ở AppRoutes).
export const LEGACY_REDIRECTS: Array<readonly [string, string]> = [
  ['/tim-tai-khoan', '/forgot-password'],
  ['/chua-xac-thuc', '/unauthorized'],
  ['/chinh-sach-bao-mat', '/privacy'],
  ['/dieu-khoan-su-dung', '/terms'],
  ['/lien-he', '/contact'],
  ['/thank-you', '/thanks'],
  ['/app/quan-ly-smart-contract', '/app/dashboard'],
  ['/app/user-elections', '/app/elections'],
  ['/app/tao-phien-bau-cu', '/app/elections/new'],
  ['/app/upcoming-elections', '/app/notifications'],
  ['/app/quan-ly-file', '/app/files'],
  ['/app/quet-ma-qr', '/app/scan'],
  ['/app/account-info', '/app/account'],
  ['/app/role-management', '/app/admin/roles'],
  ['/app/role-assignment', '/app/admin/permissions'],
];
