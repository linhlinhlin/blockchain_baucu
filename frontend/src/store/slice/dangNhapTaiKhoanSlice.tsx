import { createSlice, type PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { TaiKhoan, PhienDangNhap } from '../types';
import { dangNhap, dangNhapBangMetaMask, refreshToken } from '../../api/dangNhapTaiKhoanApi';
import { getLatestSession } from '../../api/phienDangNhapApi';

interface LoginCredentials {
  tenDangNhap: string;
  matKhau: string;
  recaptchaToken?: string;
}

interface MetaMaskLoginPayload {
  diaChiVi: string;
  nonce: string;
  signature: string;
  recaptchaToken?: string;
}

interface TrangThaiDangNhap {
  taiKhoan: TaiKhoan | null;
  accessToken: string | null;
  phienDangNhap: PhienDangNhap | null;
  dangTai: boolean;
  loi: string | null;
}

const trangThaiBanDau: TrangThaiDangNhap = {
  taiKhoan: null,
  accessToken: null,
  phienDangNhap: null,
  dangTai: false,
  loi: null,
};

const extractApiErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message ||
  error?.response?.data?.Message ||
  error?.response?.data?.error ||
  error?.message ||
  fallback;

const clearPersistedAccessToken = () => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('accessToken');
  }
};

clearPersistedAccessToken();

const taoPhienDangNhapTam = (user: TaiKhoan, accessToken: string): PhienDangNhap => ({
  id: `dev-session-${user.id}`,
  taiKhoanId: user.id,
  duLieuPhien: accessToken,
  ip: '127.0.0.1',
  thietBi: 'Development Browser',
  trinhDuyet: navigator.userAgent,
  ngayTao: new Date().toISOString(),
  ngayHetHan: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  isActive: true,
  accessToken,
});

export const login = createAsyncThunk(
  'dangNhap/login',
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await dangNhap(
        credentials.tenDangNhap,
        credentials.matKhau,
        credentials.recaptchaToken,
      );
      let latestSession: PhienDangNhap;
      try {
        latestSession = await getLatestSession(response.user.id.toString(), response.accessToken);
      } catch {
        latestSession = taoPhienDangNhapTam(response.user, response.accessToken);
      }
      localStorage.setItem('isLoggedOut', 'false');
      return { ...response, phienDangNhap: latestSession };
    } catch (error: any) {
      return rejectWithValue(extractApiErrorMessage(error, 'Lỗi khi đăng nhập'));
    }
  },
);

export const loginWithMetaMask = createAsyncThunk(
  'dangNhap/loginWithMetaMask',
  async (payload: MetaMaskLoginPayload, { rejectWithValue }) => {
    try {
      const data = await dangNhapBangMetaMask(
        payload.diaChiVi,
        payload.nonce,
        payload.signature,
        payload.recaptchaToken,
      );
      let latestSession: PhienDangNhap;
      try {
        latestSession = await getLatestSession(data.user.id.toString(), data.accessToken);
      } catch {
        latestSession = taoPhienDangNhapTam(data.user, data.accessToken);
      }
      localStorage.setItem('isLoggedOut', 'false');

      return { accessToken: data.accessToken, user: data.user, phienDangNhap: latestSession };
    } catch (error: any) {
      return rejectWithValue(extractApiErrorMessage(error, 'Lỗi khi đăng nhập với MetaMask'));
    }
  },
);

export const refreshJwtToken = createAsyncThunk(
  'dangNhap/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await refreshToken();
      let latestSession: PhienDangNhap;
      try {
        latestSession = await getLatestSession(response.user.id.toString(), response.accessToken);
      } catch {
        latestSession = taoPhienDangNhapTam(response.user, response.accessToken);
      }
      localStorage.setItem('isLoggedOut', 'false');
      return { ...response, phienDangNhap: latestSession };
    } catch (error: any) {
      return rejectWithValue(extractApiErrorMessage(error, 'Lỗi khi làm mới token'));
    }
  },
);

const dangNhapTaiKhoanSlice = createSlice({
  name: 'dangNhap',
  initialState: trangThaiBanDau,
  reducers: {
    logout: (state) => {
      state.taiKhoan = null;
      state.accessToken = null;
      state.phienDangNhap = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('metamask_session');
      document.cookie = 'refreshToken=; Max-Age=0';
    },
    loginSuccess: (
      state,
      action: PayloadAction<{
        accessToken: string;
        taiKhoan: TaiKhoan;
        phienDangNhap: PhienDangNhap;
      }>,
    ) => {
      state.accessToken = action.payload.accessToken;
      state.taiKhoan = action.payload.taiKhoan;
      state.phienDangNhap = action.payload.phienDangNhap;
      clearPersistedAccessToken();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.dangTai = true;
        state.loi = null;
      })
      .addCase(
        login.fulfilled,
        (
          state,
          action: PayloadAction<{
            accessToken: string;
            user: TaiKhoan;
            phienDangNhap: PhienDangNhap;
          }>,
        ) => {
          state.accessToken = action.payload.accessToken;
          state.taiKhoan = action.payload.user;
          state.phienDangNhap = action.payload.phienDangNhap;
          state.dangTai = false;
          state.loi = null;
          clearPersistedAccessToken();
        },
      )
      .addCase(login.rejected, (state, action) => {
        state.loi = (action.payload as string) || 'Có lỗi xảy ra';
        state.dangTai = false;
      })
      .addCase(loginWithMetaMask.pending, (state) => {
        state.dangTai = true;
        state.loi = null;
      })
      .addCase(
        loginWithMetaMask.fulfilled,
        (
          state,
          action: PayloadAction<{
            accessToken: string;
            user: TaiKhoan;
            phienDangNhap: PhienDangNhap;
          }>,
        ) => {
          state.accessToken = action.payload.accessToken;
          state.taiKhoan = action.payload.user;
          state.phienDangNhap = action.payload.phienDangNhap;
          state.dangTai = false;
          state.loi = null;
          clearPersistedAccessToken();
        },
      )
      .addCase(loginWithMetaMask.rejected, (state, action) => {
        state.loi = (action.payload as string) || 'Có lỗi xảy ra khi đăng nhập với MetaMask';
        state.dangTai = false;
      })
      .addCase(
        refreshJwtToken.fulfilled,
        (
          state,
          action: PayloadAction<{
            accessToken: string;
            user: TaiKhoan;
            phienDangNhap: PhienDangNhap;
          }>,
        ) => {
          state.accessToken = action.payload.accessToken;
          state.taiKhoan = action.payload.user;
          state.phienDangNhap = action.payload.phienDangNhap;
          state.loi = null;
          clearPersistedAccessToken();
        },
      )
      .addCase(refreshJwtToken.rejected, (state, action) => {
        state.loi = (action.payload as string) || 'Có lỗi xảy ra khi làm mới token';
      });
  },
});

export const { logout, loginSuccess } = dangNhapTaiKhoanSlice.actions;
export default dangNhapTaiKhoanSlice.reducer;
