import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { dangXuat } from '../../api/dangXuatTaiKhoanApi';
import { clearAllAccessCache } from '../../utils/authUtils';
import { resetAccessState } from './cuocBauCuAccessSlice';
import { resetCuocBauCuById } from './cuocBauCuByIdSlice';
import { resetCuocBauCuImageState } from './cuocBauCuImageSlice';
import { resetCuocBauCuState } from './cuocBauCuSlice';
import { logout as logoutDangNhap } from './dangNhapTaiKhoanSlice';
import { logout as logoutMetaMask } from './metaMaskSlice';
import { logoutPhien } from './phienDangNhapSlice';

interface TrangThaiDangXuat {
  dangTai: boolean;
  loi: string | null;
}

const trangThaiBanDau: TrangThaiDangXuat = {
  dangTai: false,
  loi: null,
};

const localStorageKeysToRemove = [
  'accessToken',
  'metamask_account',
  'metamask_session',
  'user',
  'current_user_id',
  'user_data',
  'cuocBauCuAccessState',
  'lastAccessCheck',
  'accessResults',
  'accessCache',
];

function clearLocalLogoutStorage() {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorageKeysToRemove.forEach((key) => localStorage.removeItem(key));
  localStorage.setItem('isLoggedOut', 'true');
}

function clearSessionLogoutStorage() {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  sessionStorage.clear();
}

function clearClientLogoutState(dispatch: (action: any) => void) {
  clearAllAccessCache();
  dispatch(resetAccessState());
  dispatch(resetCuocBauCuById());
  dispatch(resetCuocBauCuImageState());
  dispatch(resetCuocBauCuState());
  dispatch(logoutDangNhap());
  dispatch(logoutPhien());
  dispatch(logoutMetaMask());
  clearLocalLogoutStorage();
  clearSessionLogoutStorage();
}

export const logoutThat = createAsyncThunk('dangXuat/logout', async (_, { dispatch }) => {
  let message = 'Đã đăng xuất thành công';

  try {
    const response = await dangXuat();
    message = response.message || message;
  } catch {
    // Logging out must remain local-first. A stale MetaMask/JWT cookie should not trap the user.
    message = 'Đã đăng xuất khỏi thiết bị này';
  } finally {
    clearClientLogoutState(dispatch);
  }

  return message;
});

const dangXuatTaiKhoanSlice = createSlice({
  name: 'dangXuat',
  initialState: trangThaiBanDau,
  reducers: {
    resetDangXuatState: () => trangThaiBanDau,
  },
  extraReducers: (builder) => {
    builder
      .addCase(logoutThat.pending, (state) => {
        state.dangTai = true;
      })
      .addCase(logoutThat.fulfilled, (state) => {
        state.dangTai = false;
        state.loi = null;
      })
      .addCase(logoutThat.rejected, (state, action) => {
        state.dangTai = false;
        state.loi = action.error.message || 'Có lỗi xảy ra khi đăng xuất';
      });
  },
});

export const { resetDangXuatState } = dangXuatTaiKhoanSlice.actions;
export default dangXuatTaiKhoanSlice.reducer;
