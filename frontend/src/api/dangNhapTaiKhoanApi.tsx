import publicApiClient from './publicApiClient';
import type { TaiKhoan, PhienDangNhap } from '../store/types';

const API_URL = '/api/tai-khoan';

export interface MetaMaskLoginChallenge {
  success: boolean;
  diaChiVi: string;
  nonce: string;
  message: string;
  expiresAtUtc: string;
}

export const dangNhap = async (
  tenDangNhap: string,
  matKhau: string,
  recaptchaToken?: string,
): Promise<{ accessToken: string; user: TaiKhoan; phienDangNhap: PhienDangNhap }> => {
  const response = await publicApiClient.post(`${API_URL}/login`, {
    tenDangNhap,
    matKhau,
    recaptchaToken,
  });

  return response.data;
};

export const dangNhapBangMetaMask = async (
  diaChiVi: string,
  nonce: string,
  signature: string,
  recaptchaToken?: string,
): Promise<{ accessToken: string; user: TaiKhoan; phienDangNhap: PhienDangNhap }> => {
  const response = await publicApiClient.post(`${API_URL}/login-metamask`, {
    diaChiVi,
    nonce,
    signature,
    recaptchaToken,
  });

  return response.data;
};

export const layMetaMaskLoginChallenge = async (
  diaChiVi: string,
): Promise<MetaMaskLoginChallenge> => {
  const response = await publicApiClient.post(`${API_URL}/login-metamask/nonce`, {
    diaChiVi,
  });

  return response.data;
};

export const refreshToken = async (): Promise<{ accessToken: string; user: TaiKhoan }> => {
  const response = await publicApiClient.post(`${API_URL}/refresh-token`);
  return response.data;
};
