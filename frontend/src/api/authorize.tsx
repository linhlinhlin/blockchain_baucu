import { searchCacTaiKhoan } from './nguoiDungApi';

export async function authorize(id: number): Promise<string[]> {
  const taiKhoan = await searchCacTaiKhoan({ id });
  if (taiKhoan.length > 0) {
    // Đợt 10.1: type-only assertion (runtime-noop) cho type-lie pre-existing
    // của searchCacTaiKhoan (legacy auth); KHÔNG đổi hành vi/giá trị trả về.
    return [(taiKhoan[0] as unknown as { vaiTro: { tenVaiTro: string } }).vaiTro.tenVaiTro];
  } else {
    return [];
  }
}
