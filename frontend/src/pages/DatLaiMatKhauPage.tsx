import { useState, useEffect } from 'react';
import { useForm, FieldError } from 'react-hook-form';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { FaExclamationCircle } from 'react-icons/fa';
import SEO from '../components/SEO';
import { RootState, AppDispatch } from '../store/store';
import { datLaiMatKhau, resetTrangThai } from '../store/slice/datLaiMatKhauSlice';
import { TaiKhoan } from '../store/types';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '../components/ui/AlterDialog';
import { Button, Panel, fieldControlClass } from '../components/ui/clay';

export default function DatLaiMatKhauPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMessage, setDialogMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const user =
    (location.state?.user as TaiKhoan) || JSON.parse(localStorage.getItem('user') || '{}');
  const { dangTai, thanhCong, loi } = useSelector((state: RootState) => state.datLaiMatKhau);

  useEffect(() => {
    if (!user || !user.id) {
      alert('Không tìm thấy thông tin người dùng. Vui lòng thử lại.');
      navigate('/forgot-password');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (thanhCong) {
      setDialogMessage('Đặt lại mật khẩu thành công');
      setIsSuccess(true);
      setDialogOpen(true);
      dispatch(resetTrangThai());
    } else if (loi) {
      setDialogMessage(loi);
      setIsSuccess(false);
      setDialogOpen(true);
    }
  }, [thanhCong, loi, dispatch]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<{ matKhau: string; xacNhanMatKhau: string }>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
  });

  const onSubmit = (data: { matKhau: string; xacNhanMatKhau: string }) => {
    if (user?.id) {
      dispatch(datLaiMatKhau({ id: user.id.toString(), newPassword: data.matKhau }));
    }
  };

  function getEditorStyle(fieldError: FieldError | (FieldError | undefined)[] | undefined) {
    if (Array.isArray(fieldError)) {
      return fieldError.some((error) => error) ? 'border-[var(--state-danger)]' : '';
    }
    return fieldError ? 'border-[var(--state-danger)]' : '';
  }

  const labelStyle =
    'mb-1.5 flex items-center text-xs font-semibold uppercase tracking-[-0.01em] text-[var(--clay-muted)]';
  const errorStyle = 'mt-1 flex items-center text-[12px] text-[var(--state-danger)]';

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[var(--clay-bg)] px-4 py-10 text-[var(--clay-text)]">
      <SEO
        title="Đặt lại mật khẩu | Nền Tảng Bầu Cử Blockchain"
        description="Trang đặt lại mật khẩu cho tài khoản của bạn trên hệ thống Bầu Cử Blockchain."
        keywords="đặt lại mật khẩu, bầu cử, blockchain, tài khoản"
        author="Nền Tảng Bầu Cử Blockchain"
        url={window.location.href}
        image={`${window.location.origin}/logo.png`}
      />
      <Panel className="w-full max-w-md">
        <div className="mb-5 text-center">
          <h1 className="text-2xl font-semibold tracking-[-0.015em] text-[var(--clay-text)]">
            Đặt lại mật khẩu
          </h1>
          <p className="mt-1 text-sm text-[var(--clay-muted)]">
            Tạo mật khẩu mới cho tài khoản của bạn
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-5">
            <div>
              <label htmlFor="password" className={labelStyle}>
                Mật khẩu mới <span className="ml-1 text-[var(--state-danger)]">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu mới"
                  {...register('matKhau', {
                    required: 'Bạn phải nhập mật khẩu',
                    pattern: {
                      value: /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
                      message:
                        'Mật khẩu phải có ít nhất 8 ký tự, bao gồm 1 ký tự viết hoa, 1 ký tự số và 1 ký tự đặc biệt',
                    },
                  })}
                  className={`${fieldControlClass} pr-12 ${getEditorStyle(errors.matKhau)}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--clay-muted)]"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.matKhau && (
                <div className={errorStyle}>
                  <FaExclamationCircle className="mr-1 h-3.5 w-3.5" />
                  <small>{errors.matKhau.message}</small>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="confirm-password" className={labelStyle}>
                Xác nhận mật khẩu mới <span className="ml-1 text-[var(--state-danger)]">*</span>
              </label>
              <input
                id="confirm-password"
                type="password"
                placeholder="Xác nhận mật khẩu mới"
                {...register('xacNhanMatKhau', {
                  required: 'Bạn phải xác nhận mật khẩu',
                  validate: (value) =>
                    value === watch('matKhau') || 'Mật khẩu và xác nhận mật khẩu không khớp',
                })}
                className={`${fieldControlClass} ${getEditorStyle(errors.xacNhanMatKhau)}`}
              />
              {errors.xacNhanMatKhau && (
                <div className={errorStyle}>
                  <FaExclamationCircle className="mr-1 h-3.5 w-3.5" />
                  <small>{errors.xacNhanMatKhau.message}</small>
                </div>
              )}
            </div>
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="mt-6 w-full"
            disabled={dangTai}
            loading={dangTai}
          >
            Đặt lại mật khẩu
          </Button>
        </form>
        <div className="mt-4 flex justify-center">
          <NavLink
            to="/login"
            className="text-sm text-[var(--clay-primary)] hover:underline"
          >
            Quay lại đăng nhập
          </NavLink>
        </div>
      </Panel>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thông báo</AlertDialogTitle>
            <AlertDialogDescription>{dialogMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {isSuccess ? (
              <>
                <AlertDialogAction onClick={() => navigate('/login')}>Đăng nhập</AlertDialogAction>
                <AlertDialogCancel onClick={() => setDialogOpen(false)}>Đóng</AlertDialogCancel>
              </>
            ) : (
              <AlertDialogCancel onClick={() => setDialogOpen(false)}>Đóng</AlertDialogCancel>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
