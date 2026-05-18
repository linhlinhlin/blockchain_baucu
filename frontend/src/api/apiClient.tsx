import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { store } from '../store/store';
import { refreshJwtToken, logout } from '../store/slice/dangNhapTaiKhoanSlice';

function resolveApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) {
    return configured;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === '127.0.0.1' || host === 'localhost') {
      return 'http://localhost:5293';
    }
  }

  return 'https://webapplication320250413035557-eebmacambhenb2ha.australiacentral-01.azurewebsites.net/';
}

const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  withCredentials: true, // QUAN TRỌNG: Giúp trình duyệt gửi cookie khi request
  headers: {
    'Content-Type': 'application/json',
    Accept: '*/*', // Thêm header Accept
  },
});

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

// Tự động gắn Access Token vào mọi request
apiClient.interceptors.request.use(
  (config) => {
    const token = store.getState().dangNhapTaiKhoan.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ---- QUAN TRỌNG: Ngăn chặn làm mới token trùng lặp ----
let isRefreshing = false;
let refreshSubscribers: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach(({ resolve }) => resolve(token));
  refreshSubscribers = [];
};

const onTokenRefreshFailed = (error: unknown) => {
  refreshSubscribers.forEach(({ reject }) => reject(error));
  refreshSubscribers = [];
};

const waitForTokenRefresh = () =>
  new Promise<string>((resolve, reject) => {
    refreshSubscribers.push({ resolve, reject });
  });

const updateAuthorizationHeader = (request: RetriableRequestConfig, token: string) => {
  request.headers.Authorization = `Bearer ${token}`;
};

// ---- Xử lý tự động làm mới token ----
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (!store.getState().dangNhapTaiKhoan.accessToken) {
        store.dispatch(logout());
        return Promise.reject(error);
      }

      // Đánh dấu request đã thử làm mới
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const result = await store.dispatch(refreshJwtToken());
          if (!refreshJwtToken.fulfilled.match(result)) {
            throw result.payload ?? result.error ?? error;
          }

          const newToken = store.getState().dangNhapTaiKhoan.accessToken;

          if (newToken) {
            onTokenRefreshed(newToken);
            updateAuthorizationHeader(originalRequest, newToken);
            return apiClient(originalRequest);
          }

          throw new AxiosError('Refresh token response did not include an access token');
        } catch (refreshError) {
          onTokenRefreshFailed(refreshError);
          store.dispatch(logout());
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      try {
        const token = await waitForTokenRefresh();
        updateAuthorizationHeader(originalRequest, token);
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }
    if (!store.getState().dangNhapTaiKhoan.accessToken) {
      store.dispatch(logout());
      return Promise.reject(error);
    }
    return Promise.reject(error);
  },
);

export default apiClient;
