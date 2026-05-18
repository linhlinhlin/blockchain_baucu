'use client';

import type React from 'react';
import { useEffect, useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { NewAccountForm } from '../features/TaoTaiKhoanForm';
import { registerAccount, resetTrangThai } from '../store/slice/dangKyTaiKhoanSlice';
import type { TaoTaiKhoanTamThoi } from '../store/types';
import type { RootState, AppDispatch } from '../store/store';
import SEO from '../components/SEO';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { isRecaptchaEnabled } from '../config/runtimeFlags';

import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Shield,
  Wallet,
  User,
  Fingerprint,
  Layers,
  ArrowLeft,
  Cpu,
  Database,
} from 'lucide-react';
import { FaEthereum } from 'react-icons/fa';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { dangTai, loi, thanhCong, wallets } = useSelector(
    (state: RootState) => state.dangKyTaiKhoan,
  );
  const [showDialog, setShowDialog] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<any>(null);
  const [hluBalance, setHluBalance] = useState('0.00');

  useEffect(() => {
    if (thanhCong) {
      setShowDialog(true);
      // Không reset state ngay để có thể hiển thị thông tin ví
    }
  }, [thanhCong, dispatch]);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const handleSave = async (data: TaoTaiKhoanTamThoi, recaptchaToken: string) => {
    const newAccount: TaoTaiKhoanTamThoi = {
      ...data,
      id: '0',
      trangThai: true,
      ngayThamGia: formatDate(new Date()),
      lanDangNhapCuoi: formatDate(new Date()),
    };

    try {
      if (isRecaptchaEnabled && !recaptchaToken) {
        throw new Error('reCAPTCHA token is missing');
      }

      const result = await dispatch(
        registerAccount({ account: newAccount, recaptchaToken: recaptchaToken }),
      ).unwrap();

      // Lưu thông tin người dùng từ phản hồi
      if (result && result.user) {
        setUser(result.user);
      }
    } catch (error) {
      console.error('Đăng ký tài khoản thất bại:', error);
    }
  };

  const handleConfirm = () => {
    setShowDialog(false);
    dispatch(resetTrangThai());
    navigate('/login');
  };

  const scrollToForm = () => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey="6LdKGRYrAAAAAARohWQGLhHKWuVQE_PnjDbfA_Wb"
      scriptProps={{
        async: false,
        defer: true,
        appendTo: 'body',
        nonce: undefined,
      }}
      container={{
        parameters: {
          badge: 'bottomright',
          theme: 'light',
        },
      }}
    >
      <div className="bg-white min-h-screen">
        <SEO
          title="Đăng Ký Tài Khoản | Nền Tảng Bầu Cử Blockchain"
          description="Trang đăng ký tài khoản cho nền tảng bầu cử blockchain. Tạo tài khoản để tham gia vào quá trình bầu cử an toàn và minh bạch."
          keywords="đăng ký, tài khoản, bầu cử, blockchain, an toàn, minh bạch"
          author="Nền Tảng Bầu Cử Blockchain"
          url={window.location.href}
          image={`${window.location.origin}/logo.png`}
        />

        {/* Container cho reCAPTCHA */}
        <div id="recaptcha-container" style={{ display: 'none' }}></div>

        <div className="container mx-auto px-4 py-12 relative z-10">
          {/* Header with back button */}
          <div className="mb-8">
            <Link
              to="/"
              className="inline-flex items-center text-[#0288D1] hover:text-blue-700 transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span>Quay lại trang chủ</span>
            </Link>
          </div>

          {/* Page Title */}
          <div className="text-center mb-12">
            <div className="inline-block mb-4">
              <div className="p-4 rounded-full bg-blue-50 border border-blue-100">
                <Layers className="h-8 w-8 text-blue-400" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">
              Đăng Ký Tài Khoản Blockchain
            </h1>
            <div className="h-1 bg-[#0288D1] w-[100px] mx-auto mb-6" />
            <p className="text-gray-600 max-w-3xl mx-auto">
              Tạo tài khoản để tham gia vào nền tảng bầu cử blockchain an toàn và minh bạch. Mỗi tài
              khoản sẽ được cấp một ví blockchain để tham gia các hoạt động trên hệ thống.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
            {/* Form Section */}
            <div className="lg:col-span-7" ref={formRef}>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
                {/* Error message */}
                {loi && (
                  <div className="rounded-lg p-4 mb-6 bg-red-50 border border-red-200 flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    <p className="ml-3 text-sm text-red-700">{loi}</p>
                  </div>
                )}

                {/* Form Component */}
                <NewAccountForm onSave={handleSave} />
              </div>
            </div>

            {/* Benefits Section */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Shield className="h-5 w-5 text-blue-400 mr-2" />
                  Công Nghệ Blockchain
                </h2>

                <div className="space-y-4">
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mr-4">
                        <Database className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 mb-1">Phi Tập Trung</h3>
                        <p className="text-sm text-gray-600">
                          Dữ liệu được lưu trữ trên nhiều máy tính, không có điểm kiểm soát trung
                          tâm, đảm bảo tính minh bạch.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mr-4">
                        <Fingerprint className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 mb-1">Bất Biến</h3>
                        <p className="text-sm text-gray-600">
                          Dữ liệu một khi đã được ghi vào blockchain không thể bị thay đổi, đảm bảo
                          tính toàn vẹn.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mr-4">
                        <Cpu className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 mb-1">Smart Contract</h3>
                        <p className="text-sm text-gray-600">
                          Hợp đồng thông minh tự động thực thi các quy tắc đã được lập trình, đảm
                          bảo tính công bằng.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mr-4">
                        <Wallet className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 mb-1">Ví Blockchain</h3>
                        <p className="text-sm text-gray-600">
                          Mỗi người dùng sở hữu một ví blockchain để tương tác với hệ thống và lưu
                          trữ tài sản số.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mr-4">
                      <User className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 mb-1">Đã Có Tài Khoản?</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        Nếu bạn đã có tài khoản, hãy đăng nhập để tham gia các cuộc bầu cử.
                      </p>
                      <Link
                        to="/login"
                        className="flex items-center text-sm text-[#0288D1] hover:text-blue-700 transition-colors duration-200"
                      >
                        Đăng nhập ngay
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Success Dialog */}
        {showDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md w-full relative overflow-hidden shadow-xl">
              <div className="text-center mb-4 relative z-10">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-500/20 mb-4">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Đăng ký thành công!</h3>
                <p className="text-gray-600 mt-2">
                  Tài khoản blockchain của bạn đã được tạo thành công. Bạn có thể đăng nhập ngay
                  bây giờ.
                </p>
              </div>

              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 relative z-10">
                <h4 className="text-gray-900 font-medium mb-3 flex items-center">
                  <Wallet className="h-4 w-4 text-blue-400 mr-2" />
                  Thông tin ví blockchain của bạn
                </h4>

                {/* Hiển thị ví từ wallets nếu có */}
                {wallets && wallets.length > 0 ? (
                  wallets.map((wallet, index) => (
                    <div key={index} className="mb-3 last:mb-0">
                      <div className="flex items-center mb-1">
                        <FaEthereum className="h-4 w-4 text-orange-400 mr-2" />
                        <span className="text-sm text-gray-700">
                          {wallet.LoaiVi === 1 ? 'Smart Contract Wallet' : 'EOA Wallet'}
                        </span>
                      </div>
                      <div className="bg-white p-2 rounded border border-gray-200">
                        <p className="text-xs text-[#0288D1] font-mono break-all">
                          {wallet.DiaChiVi}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  /* Hiển thị từ dữ liệu phản hồi nếu không có wallets */
                  <div className="mb-3">
                    <div className="flex items-center mb-1">
                      <FaEthereum className="h-4 w-4 text-orange-400 mr-2" />
                      <span className="text-sm text-gray-700">Smart Contract Wallet</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-gray-200">
                      <p className="text-xs text-[#0288D1] font-mono break-all">
                        {user?.diaChiVi || 'Đang tải...'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Hiển thị ví SCW nếu có trong phản hồi */}
                {user?.diaChiViSCW && !wallets && (
                  <div className="mb-3">
                    <div className="flex items-center mb-1">
                      <FaEthereum className="h-4 w-4 text-purple-400 mr-2" />
                      <span className="text-sm text-gray-700">Smart Contract Wallet</span>
                    </div>
                    <div className="bg-white p-2 rounded border border-gray-200">
                      <p className="text-xs text-[#0288D1] font-mono break-all">
                        {user.diaChiViSCW}
                      </p>
                    </div>
                  </div>
                )}

                <div className="mt-3 text-xs text-gray-600 flex items-start">
                  <AlertCircle className="h-3 w-3 text-blue-400 mr-1 mt-0.5 flex-shrink-0" />
                  <span>
                    Lưu thông tin ví này để sử dụng trong tương lai. Bạn sẽ cần địa chỉ ví để tham
                    gia các hoạt động trên blockchain.
                  </span>
                </div>
              </div>

              {user?.diaChiVi && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 relative z-10">
                  <h4 className="text-gray-900 font-medium mb-3 flex items-center">
                    <Wallet className="h-4 w-4 text-blue-400 mr-2" />
                    Số dư HLU Token
                  </h4>
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mr-3">
                      <span className="text-xs font-bold text-white">HLU</span>
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-gray-900">
                        {hluBalance} <span className="text-[#0288D1] text-sm ml-1">HLU</span>
                      </p>
                      <p className="text-xs text-gray-600">
                        Bạn sẽ nhận được HLU Token khi tham gia các hoạt động trên hệ thống
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-center relative z-10">
                <button
                  onClick={handleConfirm}
                  className="px-6 py-2 bg-[#0288D1] text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 transition-all duration-300"
                >
                  Đến trang đăng nhập
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Container rõ ràng cho reCAPTCHA */}
      <div id="recaptcha-container" className="fixed bottom-4 right-4 z-50"></div>
    </GoogleReCaptchaProvider>
  );
};

export default RegisterPage;
