import { PATHS } from '../routes/paths';
import { resolveRouteMeta } from '../routes/routeMeta';
import { buildVoterVerificationPath, resolveScanQueryTarget } from '../utils/qrRouting';
import { appendSearchAndHash } from '../utils/routeRedirects';

const txHash = '0x79fcd6f3ca1a9e48464e74d2cfc5e79a52b6d891dd580d5b91c3912d061ca6b8';

describe('route flow policy', () => {
  test('preserves invite query and hash when redirecting to the scanner', () => {
    expect(appendSearchAndHash('/app/scan', '?token=a%2Fb', '#otp')).toBe('/app/scan?token=a%2Fb#otp');
    expect(appendSearchAndHash('/app/scan?source=invite', '?groupKey=demo')).toBe(
      '/app/scan?source=invite&groupKey=demo',
    );
  });

  test('routes scanner query parameters to the active ElectionV1 entry points', () => {
    expect(resolveScanQueryTarget(new URLSearchParams(`token=abc%2F123`))).toEqual({
      kind: 'redirect',
      path: '/verify-voter?token=abc%2F123',
    });
    expect(resolveScanQueryTarget(new URLSearchParams('groupKey=demo'))).toEqual({
      kind: 'redirect',
      path: '/verify-voter?groupKey=demo',
    });
    expect(resolveScanQueryTarget(new URLSearchParams(`chain=11155111&tx=${txHash}`))).toEqual({
      kind: 'redirect',
      path: `/verify-tx?chain=11155111&tx=${txHash}`,
    });
  });

  test('does not treat malformed transaction query as a valid route', () => {
    const target = resolveScanQueryTarget(new URLSearchParams('tx=0x1234'));
    expect(target?.kind).toBe('error');
  });

  test('prefers a specific voter token over a generic group invite', () => {
    expect(buildVoterVerificationPath({ token: 'token-1', groupKey: 'group-1' })).toBe(
      '/verify-voter?token=token-1',
    );
  });

  test('covers app sidebar destinations with Vietnamese metadata', () => {
    const expectedTitles = new Map([
      [PATHS.dashboard, 'Bảng điều khiển'],
      [PATHS.electionsNew, 'Tạo bầu cử'],
      [PATHS.elections, 'Danh sách bầu cử'],
      [PATHS.scan, 'Quét mã QR'],
      [PATHS.notifications, 'Thông báo'],
      [PATHS.files, 'Quản lý file'],
      [PATHS.account, 'Tài khoản'],
      [PATHS.settings, 'Cài đặt'],
      [PATHS.admin, 'Quản trị'],
      [PATHS.adminRoles, 'Quản lý vai trò'],
      [PATHS.adminPermissions, 'Phân quyền'],
    ]);

    for (const [path, title] of expectedTitles) {
      expect(resolveRouteMeta(path).title).toBe(title);
    }
  });

  test('uses professional metadata for dynamic election detail routes', () => {
    expect(resolveRouteMeta('/app/elections/holihu-sepolia-smoke-1779466077').title).toBe('Chi tiết bầu cử');
    expect(resolveRouteMeta('/app/elections/42/elections-tienhanh').title).toBe('Chi tiết bầu cử');
    expect(resolveRouteMeta('/app/elections/42/rules').title).toBe('Điều lệ bầu cử');
  });
});
