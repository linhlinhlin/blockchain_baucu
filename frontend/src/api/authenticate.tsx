import { searchCacTaiKhoan } from './nguoiDungApi';
import { TaiKhoan } from '../store/types';

export async function authenticate(
  tenDangNhap: string,
  matKhau: string,
): Promise<TaiKhoan | undefined> {
  try {
    const taiKhoans = await searchCacTaiKhoan({ tenDangNhap });
    // Đợt 10.1: searchCacTaiKhoan type-annotation pre-existing không khớp
    // (legacy auth). Assertion type-only (runtime-noop), KHÔNG đổi so sánh.
    const acc = taiKhoans[0] as unknown as TaiKhoan | undefined;
    if (taiKhoans.length > 0 && acc?.matKhau === matKhau) {
      return acc;
    }
    return undefined;
  } catch (error) {
    console.error('Lỗi khi xác thực tài khoản:', error);
    throw error;
  }
}

export type { TaiKhoan };
