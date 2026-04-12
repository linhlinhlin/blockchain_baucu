import publicApiClient from './publicApiClient';
import type { TaoTaiKhoanTamThoi, RegisterResponse } from '../store/types';

export async function kiemTraTenDangNhapTonTai(tenDangNhap: string): Promise<boolean> {
  const response = await publicApiClient.get('/api/tai-khoan/search', {
    params: { tenDangNhap },
  });

  const accounts = Array.isArray(response.data?.data) ? response.data.data : [];

  return accounts.some((account: { tenDangNhap?: string; TenDangNhap?: string }) => {
    const existingUsername = account.tenDangNhap ?? account.TenDangNhap ?? '';
    return existingUsername.toLowerCase() === tenDangNhap.toLowerCase();
  });
}

export async function dangKyTaiKhoan(
  taiKhoanMoi: TaoTaiKhoanTamThoi,
  recaptchaToken: string,
): Promise<RegisterResponse> {
  const tenDangNhapTonTai = await kiemTraTenDangNhapTonTai(taiKhoanMoi.tenDangNhap);

  if (tenDangNhapTonTai) {
    throw new Error('Tên đăng nhập đã tồn tại. Vui lòng chọn tên đăng nhập khác.');
  }

  const requestData = {
    TenDangNhap: taiKhoanMoi.tenDangNhap,
    MatKhau: taiKhoanMoi.matKhau,
    Email: taiKhoanMoi.email,
    Ho: taiKhoanMoi.ho,
    Ten: taiKhoanMoi.ten,
    Sdt: taiKhoanMoi.sdt,
    NgaySinh: taiKhoanMoi.ngaySinh,
    GioiTinh: taiKhoanMoi.gioiTinh,
    RecaptchaToken: recaptchaToken,
  };

  try {
    const response = await publicApiClient.post<RegisterResponse>(
      '/api/tai-khoan/dang-ky',
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Recaptcha-Token': recaptchaToken,
        },
      },
    );

    return response.data;
  } catch (error: any) {
    console.error('Lỗi khi đăng ký tài khoản:', error);

    if (error.response) {
      if (error.response.data && error.response.data.message) {
        throw new Error(error.response.data.message);
      }

      if (error.response.status === 400 && error.response.data.errors?.RecaptchaToken) {
        throw new Error('Xác thực reCAPTCHA thất bại. Vui lòng thử lại.');
      }
    }

    throw new Error('Đã xảy ra lỗi trong quá trình đăng ký tài khoản. Vui lòng thử lại sau.');
  }
}
