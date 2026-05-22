import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AlertTriangle, CheckCircle, Loader2, Mail, QrCode, Wallet } from 'lucide-react';
import ModalOTP from '../components/ModalOTP';
import {
  bindElectionV1InviteWallet,
  prepareElectionV1WalletBinding,
  resolveElectionV1VoterInviteGroup,
  resolveElectionV1VoterInvite,
  sendElectionV1InviteOtpByIdentity,
  sendElectionV1InviteOtp,
  verifyElectionV1InviteOtp,
  type ElectionV1RosterPublicInvite,
  type ElectionV1RosterInviteResolve,
} from '../api/electionV1Api';
import { useWeb3 } from '../context/Web3Context';
import type { RootState } from '../store/store';
import {
  Button,
  EmptyState,
  Field,
  fieldControlClass,
  Panel,
  StatusBadge,
  Stepper,
  type Step,
  type StatusTone,
} from '../components/ui/clay';

type PageStatus =
  | 'loading'
  | 'ready'
  | 'otp-required'
  | 'otp-verified'
  | 'wallet-bound'
  | 'deployed'
  | 'error';

const statusLabel: Record<PageStatus, string> = {
  loading: 'Đang tải',
  ready: 'Chờ OTP',
  'otp-required': 'Chờ nhập OTP',
  'otp-verified': 'Đã xác thực OTP',
  'wallet-bound': 'Đã liên kết ví',
  deployed: 'Đã triển khai',
  error: 'Cần xử lý',
};

function getErrorMessage(error: unknown) {
  const maybeError = error as any;
  if (maybeError?.response?.data?.Error) {
    return maybeError.response.data.Error;
  }
  if (maybeError?.response?.data?.error) {
    return maybeError.response.data.error;
  }
  if (maybeError instanceof Error) {
    return maybeError.message;
  }
  return 'Đã xảy ra lỗi không xác định.';
}

export default function VoterVerificationPage() {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token') ?? '';
  const groupKey = searchParams.get('groupKey') ?? '';
  const accessToken = useSelector((state: RootState) => state.dangNhapTaiKhoan.accessToken);
  const currentUser = useSelector((state: RootState) => state.dangNhapTaiKhoan.taiKhoan);
  const { currentAccount, connectWallet, signMessage, ensureNetworkAndToken } = useWeb3();

  const [activeToken, setActiveToken] = useState(tokenParam);
  const [invite, setInvite] = useState<ElectionV1RosterInviteResolve | null>(null);
  const [publicInvite, setPublicInvite] = useState<ElectionV1RosterPublicInvite | null>(null);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [message, setMessage] = useState('Đang tải thông tin lời mời…');
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpDevCode, setOtpDevCode] = useState<string | null>(null);
  const [otpDeliveryMode, setOtpDeliveryMode] = useState<string | null>(null);
  const [otpDispatchMessage, setOtpDispatchMessage] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
  const [identityEmail, setIdentityEmail] = useState('');
  const [identityStudentCode, setIdentityStudentCode] = useState('');
  const [working, setWorking] = useState(false);
  const verifyPath = activeToken
    ? `/verify-voter?token=${encodeURIComponent(activeToken)}`
    : groupKey
      ? `/verify-voter?groupKey=${encodeURIComponent(groupKey)}`
      : '/verify-voter';
  const loginRedirect = `/login?redirectTo=${encodeURIComponent(verifyPath)}`;

  const canSendOtp = Boolean(
    (invite && activeToken && !invite.otpVerified) ||
      (publicInvite && groupKey && identityEmail.trim().includes('@')),
  );
  const canBindWallet = Boolean(
    invite && activeToken && accessToken && invite.otpVerified && !invite.walletBound,
  );

  useEffect(() => {
    let active = true;

    async function loadInvite() {
      if (!tokenParam && !groupKey) {
        setStatus('ready');
        setMessage(
          'Trang này dùng để xác minh lời mời bầu cử. Hãy quét mã QR hoặc mở đường dẫn mời hợp lệ để gửi OTP và liên kết MetaMask.',
        );
        return;
      }

      try {
        setStatus('loading');

        if (!tokenParam) {
          const response = await resolveElectionV1VoterInviteGroup(groupKey);
          if (!active) {
            return;
          }

          setPublicInvite(response);
          setInvite(null);
          setActiveToken('');
          setStatus('ready');
          setMessage('Quét QR chung thành công. Nhập email trong danh sách cử tri để nhận OTP.');
          return;
        }

        setActiveToken(tokenParam);
        const response = await resolveElectionV1VoterInvite(tokenParam);
        if (!active) {
          return;
        }

        setInvite(response);
        setPublicInvite(null);
        if (response.groupDeployed) {
          setStatus(
            response.walletBound ? 'wallet-bound' : response.otpVerified ? 'otp-verified' : 'ready',
          );
          setMessage(
            'Đợt bầu cử đã được triển khai. Nếu ví của bạn đã được liên kết, bạn có thể vào ứng dụng để bỏ phiếu.',
          );
          return;
        }

        if (response.walletBound) {
          setStatus('wallet-bound');
          setMessage(
            'Ví của bạn đã được liên kết thành công. Chờ người quản trị chốt danh sách và triển khai đợt bầu cử.',
          );
        } else if (response.otpVerified) {
          setStatus('otp-verified');
          setMessage('OTP đã xác thực. Bước tiếp theo là liên kết MetaMask.');
        } else {
          setStatus('ready');
          setMessage(
            'Đã mở lời mời thành công. Bạn cần xác thực OTP trước khi liên kết MetaMask.',
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setStatus('error');
        setMessage(getErrorMessage(error));
      }
    }

    void loadInvite();
    return () => {
      active = false;
    };
  }, [groupKey, tokenParam]);

  const statusToneBadge: StatusTone = useMemo(() => {
    if (status === 'error') return 'danger';
    if (status === 'wallet-bound' || status === 'deployed') return 'success';
    if (status === 'otp-required') return 'warning';
    if (status === 'otp-verified') return 'info';
    return 'neutral';
  }, [status]);

  async function handleSendOtp() {
    if (!activeToken && !groupKey) {
      return;
    }

    setWorking(true);
    setOtpError(null);
    setOtpDevCode(null);
    setOtpDeliveryMode(null);
    setOtpDispatchMessage(null);
    setOtpExpiresAt(null);
    try {
      const response = activeToken
        ? await sendElectionV1InviteOtp(activeToken)
        : await sendElectionV1InviteOtpByIdentity(groupKey, {
            email: identityEmail.trim(),
            studentCode: identityStudentCode.trim() || null,
          });

      if (!activeToken && !response.inviteToken) {
        throw new Error('Backend chưa trả về phiên xác thực cử tri.');
      }

      if (!activeToken && response.inviteToken) {
        setActiveToken(response.inviteToken);
        const resolvedInvite = await resolveElectionV1VoterInvite(response.inviteToken);
        setInvite(resolvedInvite);
      }

      setOtpDevCode(response.devOtpCode ?? null);
      setOtpDeliveryMode(response.deliveryMode ?? null);
      setOtpDispatchMessage(response.message ?? null);
      setOtpExpiresAt(response.expiresAt ?? null);
      setMessage(response.message);
      setOtpModalOpen(true);
      setStatus('otp-required');
    } catch (error) {
      setMessage(getErrorMessage(error));
      setStatus('error');
    } finally {
      setWorking(false);
    }
  }

  async function handleVerifyOtp(otp: string) {
    if (!activeToken) {
      return;
    }

    setWorking(true);
    setOtpError(null);
    try {
      const response = await verifyElectionV1InviteOtp(activeToken, otp);
      setOtpModalOpen(false);
      setStatus('otp-verified');
      setMessage(response.message);
      if (invite) {
        setInvite({ ...invite, otpVerified: true });
      }
    } catch (error) {
      setOtpError(getErrorMessage(error));
    } finally {
      setWorking(false);
    }
  }

  async function handleBindWallet() {
    if (!activeToken || !invite) {
      return;
    }

    setWorking(true);
    try {
      const account = currentAccount ?? (await connectWallet());
      if (!account) {
        throw new Error('Không thể kết nối MetaMask.');
      }

      const networkReady = await ensureNetworkAndToken();
      if (!networkReady) {
        throw new Error('MetaMask chưa ở đúng mạng Sepolia.');
      }

      const challenge = await prepareElectionV1WalletBinding(activeToken, account);
      const signature = await signMessage(challenge.message);
      if (!signature) {
        throw new Error('Người dùng đã hủy ký thông điệp.');
      }

      const response = await bindElectionV1InviteWallet(
        activeToken,
        challenge.walletAddress,
        signature,
      );
      setInvite({
        ...invite,
        otpVerified: true,
        walletBound: true,
        walletAddress: response.walletAddress,
      });
      setStatus('wallet-bound');
      setMessage(response.message);
    } catch (error) {
      setStatus('error');
      setMessage(getErrorMessage(error));
    } finally {
      setWorking(false);
    }
  }

  // Đợt 10 US6 — Stepper tiến độ (chỉ trình bày; suy từ status, không đổi logic).
  const otpDone = ['otp-verified', 'wallet-bound', 'deployed'].includes(status);
  const bindDone = ['wallet-bound', 'deployed'].includes(status);
  const steps: Step[] = [
    {
      key: 'ident',
      title: 'Xác định cử tri',
      status: status === 'error' && !otpDone ? 'error' : otpDone || status === 'otp-required' ? 'done' : 'current',
    },
    {
      key: 'otp',
      title: 'Xác thực OTP',
      status: otpDone ? 'done' : status === 'otp-required' ? 'current' : 'todo',
    },
    {
      key: 'bind',
      title: 'Liên kết MetaMask',
      status:
        status === 'error' && otpDone
          ? 'error'
          : bindDone
            ? 'done'
            : otpDone
              ? 'current'
              : 'todo',
    },
  ];
  const hasInviteContext = Boolean(invite || publicInvite);
  const isAuthenticated = Boolean(accessToken);
  const canOpenElectionList = Boolean(invite?.walletBound || status === 'wallet-bound' || status === 'deployed');
  const displayIdentity = currentUser?.tenDangNhap ?? currentUser?.email ?? '';
  const isLoadingInvite = status === 'loading';

  return (
    <div className="min-h-screen bg-[var(--clay-bg)] px-4 py-6 text-[var(--clay-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="mb-5">
          <p className="text-xs font-semibold uppercase text-[var(--clay-muted)]">
            Luồng xác minh ElectionV1
          </p>
          <h1 className="mt-1 text-[1.75rem] font-semibold text-[var(--clay-text)]">
            Xác minh cử tri
          </h1>
          <p className="mt-1 max-w-2xl text-[15px] leading-6 text-[var(--clay-muted)]">
            Xác nhận OTP từ email mời, liên kết MetaMask, rồi chờ đợt bầu cử sẵn sàng để bỏ phiếu.
          </p>
        </header>

        {!hasInviteContext ? (
          <EmptyState
            icon={
              isLoadingInvite ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : status === 'error' ? (
                <AlertTriangle className="h-6 w-6" />
              ) : (
                <QrCode className="h-6 w-6" />
              )
            }
            title={
              isLoadingInvite
                ? 'Đang tải lời mời'
                : status === 'error'
                  ? 'Không thể mở lời mời'
                  : 'Mở link mời hoặc quét QR để bắt đầu'
            }
            description={message}
            action={!isLoadingInvite && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link
                  to="/app/scan"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-[var(--clay-primary)] bg-[var(--clay-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--clay-primary-focus)]"
                >
                  Quét mã QR
                </Link>
                <Link
                  to={loginRedirect}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-[var(--clay-border)] px-4 text-sm font-semibold text-[var(--clay-text)] hover:bg-[var(--clay-surface-soft)]"
                >
                  Đăng nhập trước
                </Link>
              </div>
            )}
          />
        ) : (
          <div className="space-y-5">
            <div className="overflow-x-auto">
              <Stepper steps={steps} />
            </div>

            <Panel>
              <div
                role={status === 'error' ? 'alert' : 'status'}
                aria-live={status === 'error' ? 'assertive' : 'polite'}
                aria-atomic="true"
                className="flex items-start gap-3"
              >
                {status === 'loading' ? (
                  <Loader2 className="mt-0.5 h-5 w-5 animate-spin" aria-hidden="true" />
                ) : status === 'wallet-bound' ? (
                  <CheckCircle className="mt-0.5 h-5 w-5 text-[var(--state-success)]" aria-hidden="true" />
                ) : status === 'error' ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--state-danger)]" aria-hidden="true" />
                ) : (
                  <Mail className="mt-0.5 h-5 w-5 text-[var(--clay-primary)]" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-[var(--clay-text)]">
                      {publicInvite && !activeToken
                        ? 'Nhận OTP bằng email trong danh sách cử tri'
                        : invite?.walletBound
                          ? 'Xác minh hoàn tất'
                          : invite?.otpVerified
                            ? 'Liên kết MetaMask'
                            : 'Xác thực OTP'}
                    </h2>
                    <StatusBadge tone={statusToneBadge}>{statusLabel[status]}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--clay-muted)]">{message}</p>
                </div>
              </div>

              {!isAuthenticated && (
                <div className="mt-4 rounded-[12px] border border-[var(--state-warning)] bg-[var(--state-warning-soft)] px-4 py-3 text-sm leading-6 text-[var(--state-warning)]">
                  Bạn có thể gửi OTP trước; bước liên kết MetaMask sẽ yêu cầu đăng nhập tài khoản thường.
                </div>
              )}
              {isAuthenticated && displayIdentity && (
                <p className="mt-3 text-sm text-[var(--clay-muted)]">
                  Đang đăng nhập: <span className="font-semibold text-[var(--clay-text)]">{displayIdentity}</span>
                </p>
              )}

              {!activeToken && publicInvite && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Field label="Email trong danh sách cử tri" className="sm:col-span-2">
                    <input
                      id="roster-email"
                      type="email"
                      value={identityEmail}
                      onChange={(event) => setIdentityEmail(event.target.value)}
                      className={fieldControlClass}
                      placeholder="name@example.com"
                      autoComplete="email"
                    />
                  </Field>
                  <Field label="Mã sinh viên / mã nội bộ" hint="Tùy chọn" className="sm:col-span-2">
                    <input
                      id="roster-student-code"
                      value={identityStudentCode}
                      onChange={(event) => setIdentityStudentCode(event.target.value)}
                      className={fieldControlClass}
                      placeholder="Tùy chọn"
                      autoComplete="off"
                    />
                  </Field>
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                {canOpenElectionList ? (
                  <Link
                    to="/app/elections"
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[12px] border border-[var(--clay-primary)] bg-[var(--clay-primary)] px-5 text-[15px] font-semibold text-white hover:bg-[var(--clay-primary-focus)]"
                  >
                    Mở danh sách bầu cử
                  </Link>
                ) : invite?.otpVerified ? (
                  isAuthenticated ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      className="flex-1"
                      onClick={() => void handleBindWallet()}
                      disabled={!canBindWallet || working}
                      loading={working && otpDone}
                      iconLeft={<Wallet className="h-4 w-4" aria-hidden="true" />}
                    >
                      Liên kết MetaMask
                    </Button>
                  ) : (
                    <Link
                      to={loginRedirect}
                      className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[12px] border border-[var(--clay-primary)] bg-[var(--clay-primary)] px-5 text-[15px] font-semibold text-white hover:bg-[var(--clay-primary-focus)]"
                    >
                      Đăng nhập để liên kết MetaMask
                    </Link>
                  )
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    className="flex-1"
                    onClick={() => void handleSendOtp()}
                    disabled={!canSendOtp || working}
                    loading={working && !invite?.otpVerified}
                  >
                    Gửi OTP đến email cử tri
                  </Button>
                )}
                <Link
                  to="/app/scan"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-[var(--clay-border)] px-4 text-sm font-semibold text-[var(--clay-text)] hover:bg-[var(--clay-surface-soft)]"
                >
                  Quét QR khác
                </Link>
              </div>

              {otpDevCode && (
                <div className="mt-3 rounded-[12px] border border-[var(--state-warning)] bg-[var(--state-warning-soft)] px-4 py-3 text-sm text-[var(--state-warning)]">
                  OTP kiểm thử: <strong>{otpDevCode}</strong>
                </div>
              )}
              {invite?.walletAddress && (
                <div className="mt-3 break-all rounded-[12px] border border-[var(--state-success)] bg-[var(--state-success-soft)] px-4 py-3 text-sm text-[var(--state-success)]">
                  Ví đã liên kết: {invite.walletAddress}
                </div>
              )}
            </Panel>

            {(invite || publicInvite) && (
              <Panel>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--clay-text)]">
                      Thông tin lời mời
                    </h2>
                    <p className="mt-1 text-sm text-[var(--clay-muted)]">
                      Dùng để kiểm tra bạn đang xác minh đúng đợt bầu cử và đúng suất bầu.
                    </p>
                  </div>
                </div>

                {invite ? (
                  <dl className="mt-4 grid gap-x-6 gap-y-4 border-t border-[var(--clay-border)] pt-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase text-[var(--clay-muted)]">Cử tri</dt>
                      <dd className="mt-1 text-base font-semibold text-[var(--clay-text)]">{invite.fullName}</dd>
                      <dd className="mt-1 text-sm text-[var(--clay-muted)]">{invite.emailMasked}</dd>
                      {invite.studentCode && (
                        <dd className="text-sm text-[var(--clay-muted)]">MSSV: {invite.studentCode}</dd>
                      )}
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase text-[var(--clay-muted)]">Đợt bầu cử</dt>
                      <dd className="mt-1 text-base font-semibold text-[var(--clay-text)]">{invite.ballotTitle}</dd>
                      <dd className="mt-1 text-sm text-[var(--clay-muted)]">
                        Mở bỏ phiếu: {new Date(invite.commitStart).toLocaleString('vi-VN')}
                      </dd>
                      <dd className="text-sm text-[var(--clay-muted)]">
                        Kết thúc kiểm phiếu: {new Date(invite.revealEnd).toLocaleString('vi-VN')}
                      </dd>
                    </div>
                  </dl>
                ) : publicInvite ? (
                  <dl className="mt-4 grid gap-x-6 gap-y-4 border-t border-[var(--clay-border)] pt-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-semibold uppercase text-[var(--clay-muted)]">Danh sách cử tri chung</dt>
                      <dd className="mt-1 text-base font-semibold text-[var(--clay-text)]">{publicInvite.ballotTitle}</dd>
                      <dd className="mt-1 text-sm text-[var(--clay-muted)]">
                        {publicInvite.totalInviteCount} cử tri trong danh sách
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase text-[var(--clay-muted)]">Tiến độ</dt>
                      <dd className="mt-1 text-sm text-[var(--clay-muted)]">
                        Đã xác thực OTP: {publicInvite.otpVerifiedCount}
                      </dd>
                      <dd className="text-sm text-[var(--clay-muted)]">
                        Đã liên kết ví: {publicInvite.walletBoundCount}
                      </dd>
                      <dd className="mt-1 text-sm text-[var(--clay-muted)]">
                        Kết thúc kiểm phiếu: {new Date(publicInvite.revealEnd).toLocaleString('vi-VN')}
                      </dd>
                    </div>
                  </dl>
                ) : null}

                <div className="mt-5 border-t border-[var(--clay-border)] pt-4">
                  <p className="text-xs font-semibold uppercase text-[var(--clay-muted)]">
                    Chức vụ trong đợt bầu cử
                  </p>
                  <div className="mt-3 grid gap-3">
                    {(invite?.positions ?? publicInvite?.positions ?? []).map((position) => (
                      <div
                        key={position.positionId}
                        className="rounded-[14px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-4"
                      >
                        <p className="font-semibold text-[var(--clay-text)]">{position.title}</p>
                        {position.description && (
                          <p className="mt-1 text-sm text-[var(--clay-muted)]">
                            {position.description}
                          </p>
                        )}
                        <p className="mt-2 text-sm text-[var(--clay-muted)]">
                          Ứng viên: {position.candidateNames.join(', ')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            )}
          </div>
        )}
      </div>

      <ModalOTP
        isOpen={otpModalOpen}
        onClose={() => setOtpModalOpen(false)}
        onVerify={(otp) => void handleVerifyOtp(otp)}
        email={invite?.emailMasked ?? identityEmail}
        onResend={() => void handleSendOtp()}
        error={otpError}
        deliveryMode={otpDeliveryMode}
        devOtpCode={otpDevCode}
        dispatchMessage={otpDispatchMessage}
        expiresAt={otpExpiresAt}
      />
    </div>
  );
}
