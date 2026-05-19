import type React from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

// Đợt 13 (hiệu năng): route-level code-splitting. Shell/ErrorPage/HOC/provider
// giữ static (cần ngay/độ tin cậy); mọi trang ../pages/* → lazy() ⇒ tách chunk
// theo route, giảm mạnh bundle index ban đầu. Routing/guard/redirect KHÔNG đổi.
import AppBeforeLogin from '../AppBeforeLogin';
import AppAfterLogin from '../AppAfterLogin';
import ErrorPage from '../pages/ErrorPage';
import withElectionId from '../components/withElectionId';
import ThongBaoKhongCoPhien from '../components/ThongBaoKhongCoCuocBauCu';
import ProtectedRoute from '../routes/ProtectedRoute';
import withPhienBauCuId from '../components/withPhienBauCuId';
import { Web3Provider } from '../context/Web3Context';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../components/ui/Use-toast';
import { ReCaptchaProvider } from '../components/ui/Use-recaptcha';
import { isRecaptchaEnabled } from '../config/runtimeFlags';

const CacPhienBauCuPage = lazy(() => import('../pages/CacCuocBauCuPage'));
const XemChiTietCuocBauCuPage = lazy(() => import('../pages/XemChiTietCuocBauCuPage'));
const HomePage = lazy(() => import('../pages/HomePage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const RoleManagementPage = lazy(() => import('../pages/QuanLyVaiTroAdminPage'));
const RoleAssignmentPage = lazy(() => import('../pages/PhanQuyenAdminPage'));
const AccountInfoPage = lazy(() => import('../pages/ThongTinTaiKhoanPage'));
const WelcomePage = lazy(() => import('../pages/ChaoMungPage'));
const ThankYouPage = lazy(() => import('../pages/CamOnPage'));
const FindAccountPage = lazy(() => import('../pages/TimTaiKhoanPage'));
const AccountOptionsPage = lazy(() => import('../pages/TuyChonTaiKhoanPage'));
const RegisterPage = lazy(() => import('../pages/DangKyTaiKhoanPage'));
const SettingsPage = lazy(() => import('../pages/CaiDatPage'));
const UserElectionsPage = lazy(() => import('../pages/CuocBauCuCuaNguoiDungPage'));
const TaoPhienBauCuPage = lazy(() => import('../pages/TaoCuocBauCuPage'));
const UpcomingElectionsPage = lazy(() => import('../pages/ThongBaoCuocBauCuPage'));
const ElectionTienHanh = lazy(() => import('../pages/ThongTinChiTietCuocBauCu'));
const ChinhSachBaoMat = lazy(() => import('../pages/ChinhSachBaoMatPage'));
const DieuKhoanSuDung = lazy(() => import('../pages/DieuKhoanSuDungPage'));
const LienHePage = lazy(() => import('../pages/LienHe'));
const UnauthorizedPage = lazy(() => import('../pages/UnauthoriedPage'));
const GuiOTPPage = lazy(() => import('../pages/GuiOTPPage'));
const DatLaiMatKhauPage = lazy(() => import('../pages/DatLaiMatKhauPage'));
const QuanLyFilePage = lazy(() => import('../pages/QuanLyFilePage'));
const QuetMaQRPage = lazy(() => import('../pages/QuetMaQRPage'));
const QuanLySmartContractPage = lazy(() => import('../pages/QuanLySmartContractPage'));
const FAQ = lazy(() => import('../pages/FaqPage'));
const BlockchainSetupPage = lazy(() => import('../pages/BlockchainSetupPage'));
const DieuLePage = lazy(() => import('../pages/DieuLePage'));
const PhienBauCuBlockchainDeploymentPage = lazy(
  () => import('../pages/PhienBauCuBlockchainDeploymentPage'),
);
const ChinhSuaPhienBauCuPage = lazy(() => import('../pages/ChinhSuaPhienBauCuPage'));
const VoterVerificationPage = lazy(() => import('../pages/VoterVerificationPage'));
const ElectionSessionManagerPage = lazy(() => import('../pages/ElectionSessionManagerPage'));
const XemChiTietPhienBauCuPage = lazy(() => import('../pages/XemChiTietPhienBauCuPage'));

const AdminPage = lazy(() => import('../pages/AdminPage'));

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--clay-muted)',
        fontSize: 14,
      }}
      role="status"
      aria-live="polite"
    >
      <span
        style={{
          width: 22,
          height: 22,
          border: '3px solid currentColor',
          borderRightColor: 'transparent',
          borderRadius: '50%',
          display: 'inline-block',
          animation: 'spin 0.7s linear infinite',
        }}
        aria-hidden="true"
      />
      <span style={{ marginLeft: 10 }}>Đang tải…</span>
    </div>
  );
}

const XemChiTietCuocBauCuPageWithId = withElectionId(XemChiTietCuocBauCuPage);
// Using type assertion to resolve the type incompatibility
const XemChiTietPhienBauCuPageWithId = withPhienBauCuId(
  XemChiTietPhienBauCuPage as React.ComponentType<any>,
);

// Bọc toàn bộ ứng dụng trong các providers cần thiết
const AppWithProviders = ({
  children,
  useRecaptcha = false,
}: {
  children: React.ReactNode;
  useRecaptcha?: boolean;
}) => (
  <ThemeProvider>
    <ToastProvider>
      {useRecaptcha && isRecaptchaEnabled ? (
        <GoogleReCaptchaProvider
          reCaptchaKey="6LdKGRYrAAAAAARohWQGLhHKWuVQE_PnjDbfA_Wb"
          scriptProps={{
            async: false,
            defer: true,
            appendTo: 'body',
          }}
          container={{
            parameters: {
              badge: 'bottomright',
              theme: 'dark',
            },
          }}
        >
          <ReCaptchaProvider>
            <Web3Provider>
              <Suspense fallback={<RouteFallback />}>{children}</Suspense>
            </Web3Provider>
          </ReCaptchaProvider>
        </GoogleReCaptchaProvider>
      ) : (
        <Web3Provider>{children}</Web3Provider>
      )}
    </ToastProvider>
  </ThemeProvider>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AppWithProviders>
        <AppBeforeLogin />
      </AppWithProviders>
    ),
    errorElement: (
      <AppWithProviders>
        <ErrorPage />
      </AppWithProviders>
    ),
    children: [
      {
        index: true,
        element: <WelcomePage />,
      },
      {
        path: 'thong-bao-khong-co-phien',
        element: <ThongBaoKhongCoPhien />,
      },

      // {
      //   path: 'blockchain-realtime',
      //   element: <ThongTinBlockchainRealTimePage />,
      // },
      {
        path: 'elections',
        element: <CacPhienBauCuPage />,
      },
      {
        path: 'tim-tai-khoan',
        element: <FindAccountPage />,
      },
      {
        path: 'tim-tai-khoan/:username/:randomCode/tuy-chon',
        element: <AccountOptionsPage />,
      },
      {
        path: 'tim-tai-khoan/:username/:randomCode/tuy-chon/gui-otp',
        element: <GuiOTPPage />,
      },
      {
        path: 'tim-tai-khoan/:username/:randomCode/tuy-chon/gui-otp/dat-lai-mat-khau',
        element: <DatLaiMatKhauPage />,
      },
      {
        path: 'chua-xac-thuc',
        element: <UnauthorizedPage />,
      },
      {
        path: 'register',
        element: (
          <AppWithProviders useRecaptcha={true}>
            <RegisterPage />
          </AppWithProviders>
        ),
      },
    ],
  },
  // Thêm route mới cho trang xác thực cử tri
  {
    path: 'verify-voter',
    element: (
      <AppWithProviders>
        <VoterVerificationPage />
      </AppWithProviders>
    ),
    errorElement: (
      <AppWithProviders>
        <ErrorPage />
      </AppWithProviders>
    ),
  },
  {
    path: 'login',
    element: (
      <AppWithProviders useRecaptcha={true}>
        <LoginPage />
      </AppWithProviders>
    ),
    errorElement: (
      <AppWithProviders>
        <ErrorPage />
      </AppWithProviders>
    ),
  },
  {
    path: 'chinh-sach-bao-mat',
    element: (
      <AppWithProviders>
        <ChinhSachBaoMat />
      </AppWithProviders>
    ),
    errorElement: (
      <AppWithProviders>
        <ErrorPage />
      </AppWithProviders>
    ),
  },
  {
    path: 'dieu-khoan-su-dung',
    element: (
      <AppWithProviders>
        <DieuKhoanSuDung />
      </AppWithProviders>
    ),
    errorElement: (
      <AppWithProviders>
        <ErrorPage />
      </AppWithProviders>
    ),
  },
  {
    path: 'faq',
    element: (
      <AppWithProviders>
        <FAQ />
      </AppWithProviders>
    ),
    errorElement: (
      <AppWithProviders>
        <ErrorPage />
      </AppWithProviders>
    ),
  },
  {
    path: 'lien-he',
    element: (
      <AppWithProviders>
        <LienHePage />
      </AppWithProviders>
    ),
    errorElement: (
      <AppWithProviders>
        <ErrorPage />
      </AppWithProviders>
    ),
  },
  {
    path: 'blockchain-setup',
    element: (
      <AppWithProviders>
        <BlockchainSetupPage />
      </AppWithProviders>
    ),
    errorElement: (
      <AppWithProviders>
        <ErrorPage />
      </AppWithProviders>
    ),
  },
  {
    path: 'main',
    element: (
      <AppWithProviders>
        <Navigate to="/app" replace />
      </AppWithProviders>
    ),
    errorElement: (
      <AppWithProviders>
        <ErrorPage />
      </AppWithProviders>
    ),
  },
  {
    path: 'thank-you',
    element: (
      <AppWithProviders>
        <ThankYouPage />
      </AppWithProviders>
    ),
    errorElement: (
      <AppWithProviders>
        <ErrorPage />
      </AppWithProviders>
    ),
  },
  {
    path: '/invite',
    element: (
      <AppWithProviders>
        <Navigate to="/app/quet-ma-qr" replace />
      </AppWithProviders>
    ),
  },
  {
    path: 'bat-dau-cuoc-bau-cu',
    element: (
      <AppWithProviders>
        <Navigate to="/app/tao-phien-bau-cu" replace />
      </AppWithProviders>
    ),
  },
  {
    path: 'cap-phieu-bau',
    element: (
      <AppWithProviders>
        <Navigate to="/app/quet-ma-qr" replace />
      </AppWithProviders>
    ),
  },
  {
    path: '/app',
    element: (
      <AppWithProviders>
        <ProtectedRoute requiredPermissions={['Quan Tri Vien', 'Nguoi Dung']}>
          <AppAfterLogin />
        </ProtectedRoute>
      </AppWithProviders>
    ),
    errorElement: (
      <AppWithProviders>
        <ErrorPage />
      </AppWithProviders>
    ),
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'elections',
        element: <Navigate to="/app/user-elections" replace />,
      },
      {
        path: 'elections/:id',
        element: <Navigate to="/app/user-elections" replace />,
      },
      {
        path: 'elections/:id/session/:idPhien',
        element: <Navigate to="/app/quan-ly-smart-contract" replace />,
      },
      {
        path: 'tao-phien-bau-cu',
        element: <TaoPhienBauCuPage />,
      },
      {
        path: 'elections/:id/elections-tienhanh',
        element: (
          <ProtectedRoute
            requiredPermissions={['Quan Tri Vien', 'Nguoi Dung']}
            requiresElectionAccess={true}
          >
            <ElectionTienHanh />
          </ProtectedRoute>
        ),
      },
      {
        path: 'account-info',
        element: <AccountInfoPage />,
      },
      {
        path: 'upcoming-elections',
        element: <UpcomingElectionsPage />,
      },
      {
        path: 'admin',
        element: (
          <Suspense
            fallback={<div className="text-center p-5 text-xl text-slate-900">Loading...</div>}
          >
            <AdminPage />
          </Suspense>
        ),
      },
      {
        path: 'role-management',
        element: (
          <ProtectedRoute requiredPermissions={['Quan Tri Vien', 'Quản Lý Vai Trò']}>
            <RoleManagementPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'role-assignment',
        element: (
          <ProtectedRoute requiredPermissions={['Quan Tri Vien', 'Quản Lý Vai Trò']}>
            <RoleAssignmentPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'quan-ly-file',
        element: <QuanLyFilePage />,
      },
      {
        path: 'quet-ma-qr',
        element: <QuetMaQRPage />, // Thêm đường dẫn cho QuetMaQRPage
      },
      {
        path: 'user-elections',
        element: <UserElectionsPage />,
      },
      // Thêm route trực tiếp cho trang quản lý phiên bầu cử blockchain
      {
        path: 'election-session-manager',
        element: <Navigate to="/app/quan-ly-smart-contract" replace />,
      },
      // Thêm route cho trang quản lý phiên bầu cử blockchain với tham số ID
      {
        path: 'election-session-manager/:id',
        element: <Navigate to="/app/quan-ly-smart-contract" replace />,
      },
      {
        path: 'user-elections/elections/:id/election-management',
        element: <Navigate to="/app/quan-ly-smart-contract" replace />,
      },
      {
        path: 'user-elections/elections/:id/election-management/:idPhien/phien-bau-cu',
        element: <Navigate to="/app/quan-ly-smart-contract" replace />,
      },
      // Thêm route mới cho trang triển khai phiên bầu cử lên blockchain
      {
        path: 'user-elections/elections/:id/session/:sessionId/deploy',
        element: <Navigate to="/app/quan-ly-smart-contract" replace />,
      },
      {
        path: 'user-elections/elections/:id/edit',
        element: <Navigate to="/app/tao-phien-bau-cu" replace />,
      },
      {
        path: 'user-elections/elections/:id/election-management/candidate-management',
        element: <Navigate to="/app/tao-phien-bau-cu" replace />,
      },
      {
        path: 'user-elections/elections/:id/election-management/voter-management',
        element: <Navigate to="/app/tao-phien-bau-cu" replace />,
      },
      {
        path: 'invite',
        element: <Navigate to="/app/quet-ma-qr" replace />,
      },
      {
        path: 'quan-ly-thanh-tuu',
        element: <Navigate to="/app/user-elections" replace />,
      },
      {
        path: 'ket-qua-bau-cu',
        element: <Navigate to="/app/user-elections" replace />,
      },
      {
        path: 'quan-ly-smart-contract',
        element: <QuanLySmartContractPage />,
      },
      {
        path: 'user-elections/elections/:id/blockchain-deployment',
        element: <Navigate to="/app/quan-ly-smart-contract" replace />,
      },
      {
        path: 'user-elections/elections/:id/rules',
        element: (
          <ProtectedRoute
            requiredPermissions={['Quan Tri Vien', 'Nguoi Dung']}
            requiresElectionAccess={true}
          >
            <DieuLePage />
          </ProtectedRoute>
        ),
      },
      // Thêm route cho trang ThamGiaBauCu
      {
        path: 'elections/:id/session/:idPhien/participate',
        element: (
          <ProtectedRoute requiredPermissions={['Quan Tri Vien', 'Nguoi Dung']}>
            <QuanLySmartContractPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'user-elections/elections/:id/session/:idPhien/edit',
        element: <Navigate to="/app/tao-phien-bau-cu" replace />,
      },
    ],
  },
  {
    path: '*',
    element: (
      <AppWithProviders>
        <ErrorPage />
      </AppWithProviders>
    ),
    errorElement: (
      <AppWithProviders>
        <ErrorPage />
      </AppWithProviders>
    ),
  },
]);

export function AppRoutes() {
  return <RouterProvider router={router} />;
}
