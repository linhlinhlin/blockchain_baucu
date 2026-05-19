import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTimTaiKhoan } from '../store/slice/timTaiKhoanSlice';
import { RootState, AppDispatch } from '../store/store';
import SEO from '../components/SEO';
import PaginationPhu from '../components/PaginationPhu';
import { Button, Panel, fieldControlClass } from '../components/ui/clay';

const TimTaiKhoanPage: React.FC = () => {
  const [input, setInput] = useState('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [usersPerPage] = useState<number>(3);
  const navigate = useNavigate();
  const dispatch: AppDispatch = useDispatch();
  const { foundUsers, status, error } = useSelector((state: RootState) => state.timTaiKhoan);

  const handleFindAccount = async () => {
    setCurrentPage(1);
    dispatch(fetchTimTaiKhoan(input));
  };

  const handleSelectAccount = (user: any) => {
    const randomCode = Math.random().toString(36).substring(2, 15);
    navigate(`/tim-tai-khoan/${user.tenDangNhap}/${randomCode}/tuy-chon`, {
      state: { user },
    });
  };

  const maskPhoneNumber = (phone: string | undefined) => {
    if (!phone) return 'Số điện thoại không hợp lệ'; // Trả về thông báo lỗi nếu phone là undefined
    return phone.replace(/(\d{2})(\d+)(\d{3})/, '+$1*******$3');
  };

  const maskEmail = (email: string | undefined) => {
    if (!email || !email.includes('@')) return 'Email không hợp lệ';
    const [localPart, domain] = email.split('@');
    return `${localPart[0]}${localPart[1]}***@***${domain.slice(-1)}`;
  };

  // Tính toán các tài khoản hiển thị trên trang hiện tại
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = foundUsers.data.slice(indexOfFirstUser, indexOfLastUser);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[var(--clay-bg)] p-4 text-[var(--clay-text)]">
      <SEO
        title="Tìm Tài Khoản | Nền Tảng Bầu Cử Blockchain"
        description="Tìm tài khoản của bạn bằng cách nhập tên hoặc email."
        keywords="tìm tài khoản, bầu cử, nền tảng bầu cử, blockchain"
        author="Nền Tảng Bầu Cử Blockchain"
        url={window.location.href}
        image={`${window.location.origin}/logo.png`}
      />
      <Panel className="w-full max-w-md space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.015em] text-[var(--clay-text)] md:text-2xl">
            Tìm tài khoản của bạn
          </h1>
          <p className="mt-1 text-sm text-[var(--clay-muted)]">
            Nhập tên hoặc email để tìm kiếm tài khoản của bạn.
          </p>
        </div>
        {status === 'failed' && (
          <p role="alert" className="text-sm text-[var(--state-danger)]">
            {error}
          </p>
        )}
        <input
          type="text"
          placeholder="Tên hoặc email"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Tên hoặc email"
          className={fieldControlClass}
        />
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={() => navigate('/login')}>
            Hủy
          </Button>
          <Button type="button" variant="primary" onClick={handleFindAccount}>
            Tìm kiếm
          </Button>
        </div>
        {status === 'loading' && (
          <p className="text-sm text-[var(--clay-primary)]">Đang tìm kiếm...</p>
        )}
        {status === 'succeeded' && currentUsers.length === 0 && (
          <p className="text-sm text-[var(--state-danger)]">Không tìm thấy tài khoản.</p>
        )}
        {currentUsers.length > 0 && (
          <div className="space-y-3">
            {currentUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectAccount(user)}
                className="flex w-full items-center gap-4 rounded-[14px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-4 text-left hover:bg-[var(--clay-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--clay-primary-focus)]"
              >
                <img
                  src={user.avatar}
                  alt={user.tenDangNhap}
                  className="h-14 w-14 rounded-full object-cover"
                />
                <div className="min-w-0">
                  <h4 className="font-semibold text-[var(--clay-text)]">{user.tenDangNhap}</h4>
                  <p className="text-sm text-[var(--clay-muted)]">{maskEmail(user.email)}</p>
                  <p className="text-sm text-[var(--clay-muted)]">{maskPhoneNumber(user.sdt)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {foundUsers.data.length > usersPerPage && (
          <PaginationPhu
            currentPage={currentPage}
            totalPages={Math.ceil(foundUsers.data.length / usersPerPage)}
            onPageChange={setCurrentPage}
          />
        )}
      </Panel>
    </div>
  );
};

export default TimTaiKhoanPage;
