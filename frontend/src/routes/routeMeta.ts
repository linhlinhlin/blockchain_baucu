// Đợt 10 (spec 010) — FR-001: suy ra title/breadcrumb/section cho shell.
// KHÔNG sửa cây route trong AppRoutes.tsx. Chỉ tra cứu theo location.pathname.
// Hợp đồng: .specify/specs/010-ux-professionalization/contracts/route-ia.md

export type Section = 'Bầu cử' | 'Cử tri' | 'Khác' | 'Quản trị';

export interface Crumb {
  label: string;
  to?: string;
}

export interface RouteMeta {
  title: string;
  section: Section;
  breadcrumb: Crumb[];
  /** Public QR/email entry can redirect into the app shell after login. */
  outsideShell?: boolean;
}

const HOME: Crumb = { label: 'Trang chủ', to: '/app' };

const ROUTE_META: Record<string, RouteMeta> = {
  '/app': {
    title: 'Trang chủ',
    section: 'Bầu cử',
    breadcrumb: [{ label: 'Trang chủ' }],
  },
  '/app/dashboard': {
    title: 'Bảng điều khiển',
    section: 'Bầu cử',
    breadcrumb: [HOME, { label: 'Bầu cử' }, { label: 'Bảng điều khiển' }],
  },
  '/app/elections/new': {
    title: 'Tạo bầu cử',
    section: 'Bầu cử',
    breadcrumb: [HOME, { label: 'Bầu cử' }, { label: 'Tạo bầu cử' }],
  },
  '/app/elections': {
    title: 'Danh sách bầu cử',
    section: 'Bầu cử',
    breadcrumb: [HOME, { label: 'Bầu cử' }, { label: 'Danh sách bầu cử' }],
  },
  '/app/scan': {
    title: 'Quét mã QR',
    section: 'Cử tri',
    breadcrumb: [HOME, { label: 'Cử tri' }, { label: 'Quét mã QR' }],
  },
  '/app/verify-voter': {
    title: 'Xác minh cử tri',
    section: 'Cử tri',
    breadcrumb: [HOME, { label: 'Cử tri' }, { label: 'Xác minh cử tri' }],
  },
  '/app/verify-tx': {
    title: 'Kiểm chứng giao dịch',
    section: 'Cử tri',
    breadcrumb: [HOME, { label: 'Cử tri' }, { label: 'Kiểm chứng giao dịch' }],
  },
  '/app/account': {
    title: 'Tài khoản',
    section: 'Khác',
    breadcrumb: [HOME, { label: 'Tài khoản' }],
  },
  '/app/notifications': {
    title: 'Thông báo',
    section: 'Khác',
    breadcrumb: [HOME, { label: 'Khác' }, { label: 'Thông báo' }],
  },
  '/app/files': {
    title: 'Quản lý file',
    section: 'Khác',
    breadcrumb: [HOME, { label: 'Khác' }, { label: 'Quản lý file' }],
  },
  '/app/settings': {
    title: 'Cài đặt',
    section: 'Khác',
    breadcrumb: [HOME, { label: 'Khác' }, { label: 'Cài đặt' }],
  },
  '/app/admin': {
    title: 'Quản trị',
    section: 'Quản trị',
    breadcrumb: [HOME, { label: 'Quản trị' }],
  },
  '/app/admin/roles': {
    title: 'Quản lý vai trò',
    section: 'Quản trị',
    breadcrumb: [HOME, { label: 'Quản trị' }, { label: 'Quản lý vai trò' }],
  },
  '/app/admin/permissions': {
    title: 'Phân quyền',
    section: 'Quản trị',
    breadcrumb: [HOME, { label: 'Quản trị' }, { label: 'Phân quyền' }],
  },
  '/verify-voter': {
    title: 'Xác minh cử tri',
    section: 'Cử tri',
    breadcrumb: [{ label: 'Xác minh cử tri' }],
    outsideShell: true,
  },
  '/verify-tx': {
    title: 'Kiểm chứng giao dịch',
    section: 'Cử tri',
    breadcrumb: [{ label: 'Kiểm chứng giao dịch' }],
    outsideShell: true,
  },
};

function normalize(pathname: string): string {
  if (!pathname) return '/app';
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed.length ? trimmed : '/';
}

/**
 * Không bao giờ ném lỗi. Route không khai báo (động/redirect) → fallback
 * suy từ segment cuối, section 'Khác', breadcrumb tối thiểu.
 */
export function resolveRouteMeta(pathname: string): RouteMeta {
  const key = normalize(pathname);
  const hit = ROUTE_META[key];
  if (hit) return hit;

  if (/^\/app\/elections\/[^/]+$/.test(key)) {
    return {
      title: 'Chi tiết bầu cử',
      section: 'Bầu cử',
      breadcrumb: [
        HOME,
        { label: 'Bầu cử', to: '/app/elections' },
        { label: 'Chi tiết bầu cử' },
      ],
    };
  }

  if (/^\/app\/elections\/[^/]+\/elections-tienhanh$/.test(key)) {
    return {
      title: 'Chi tiết bầu cử',
      section: 'Bầu cử',
      breadcrumb: [HOME, { label: 'Bầu cử' }, { label: 'Chi tiết bầu cử' }],
    };
  }

  if (/^\/app\/elections\/[^/]+\/rules$/.test(key)) {
    return {
      title: 'Điều lệ bầu cử',
      section: 'Bầu cử',
      breadcrumb: [HOME, { label: 'Bầu cử' }, { label: 'Điều lệ bầu cử' }],
    };
  }

  const seg = key.split('/').filter(Boolean).pop() ?? 'app';
  const title = seg
    .replace(/-/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
  return {
    title,
    section: 'Khác',
    breadcrumb: [HOME, { label: title }],
  };
}

export default resolveRouteMeta;
