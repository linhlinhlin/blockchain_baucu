import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CheckCircle, Loader2, Mail, Wallet, AlertTriangle } from 'lucide-react';
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
        setStatus('error');
        setMessage('Token lời mời không hợp lệ.');
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
          setMessage('Quét QR chung thành công. Nhập email trong roster để nhận OTP.');
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
            'Ballot đã được deploy. Nếu ví của bạn đã được bind, bạn có thể vào app để bỏ phiếu.',
          );
          return;
        }

        if (response.walletBound) {
          setStatus('wallet-bound');
          setMessage(
            'Ví của bạn đã được bind thành công. Chờ admin chốt danh sách và deploy ballot.',
          );
        } else if (response.otpVerified) {
          setStatus('otp-verified');
          setMessage('OTP đã xác thực. Bước tiếp theo là bind MetaMask.');
        } else {
          setStatus('ready');
          setMessage(
            'Scan QR / mở lời mời thành công. Bạn cần xác thực OTP trước khi bind MetaMask.',
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
      title: 'Bind MetaMask',
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

  return (
    <div className="min-h-screen bg-[var(--clay-bg)] px-4 py-8 text-[var(--clay-text)]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.015em] text-[var(--clay-text)]">
            Xác minh cử tri
          </h1>
          <p className="mt-1 text-[15px] text-[var(--clay-muted)]">
            Xác thực OTP và bind MetaMask cho ElectionV1 theo từng bước.
          </p>
          <div className="mt-4 overflow-x-auto">
            <Stepper steps={steps} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_360px]">
          <div className="space-y-6">
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
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[var(--clay-text)]">Trạng thái hiện tại</p>
                    <StatusBadge tone={statusToneBadge}>{status}</StatusBadge>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[var(--clay-muted)]">{message}</p>
                </div>
              </div>
            </Panel>

            {invite && (
              <div className="grid gap-4 md:grid-cols-2">
                <Panel>
                  <p className="text-xs font-semibold uppercase tracking-[-0.01em] text-[var(--clay-muted)]">
                    Cử tri
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[var(--clay-text)]">
                    {invite.fullName}
                  </p>
                  <p className="mt-2 text-sm text-[var(--clay-muted)]">{invite.emailMasked}</p>
                  {invite.studentCode && (
                    <p className="text-sm text-[var(--clay-muted)]">MSSV: {invite.studentCode}</p>
                  )}
                </Panel>
                <Panel>
                  <p className="text-xs font-semibold uppercase tracking-[-0.01em] text-[var(--clay-muted)]">
                    Ballot
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[var(--clay-text)]">
                    {invite.ballotTitle}
                  </p>
                  <p className="mt-2 text-sm text-[var(--clay-muted)]">
                    Commit: {new Date(invite.commitStart).toLocaleString('vi-VN')}
                  </p>
                  <p className="text-sm text-[var(--clay-muted)]">
                    Reveal: {new Date(invite.revealEnd).toLocaleString('vi-VN')}
                  </p>
                </Panel>
              </div>
            )}

            {!invite && publicInvite && (
              <div className="grid gap-4 md:grid-cols-2">
                <Panel>
                  <p className="text-xs font-semibold uppercase tracking-[-0.01em] text-[var(--clay-muted)]">
                    Roster chung
                  </p>
                  <p className="mt-2 text-xl font-semibold text-[var(--clay-text)]">
                    {publicInvite.ballotTitle}
                  </p>
                  <p className="mt-2 text-sm text-[var(--clay-muted)]">
                    {publicInvite.totalInviteCount} cử tri trong roster
                  </p>
                </Panel>
                <Panel>
                  <p className="text-xs font-semibold uppercase tracking-[-0.01em] text-[var(--clay-muted)]">
                    Tiến độ
                  </p>
                  <p className="mt-2 text-sm text-[var(--clay-muted)]">
                    OTP verified: {publicInvite.otpVerifiedCount}
                  </p>
                  <p className="text-sm text-[var(--clay-muted)]">
                    Wallet bound: {publicInvite.walletBoundCount}
                  </p>
                  <p className="mt-2 text-sm text-[var(--clay-muted)]">
                    Reveal: {new Date(publicInvite.revealEnd).toLocaleString('vi-VN')}
                  </p>
                </Panel>
              </div>
            )}

            {(invite || publicInvite) && (
              <Panel>
                <p className="text-xs font-semibold uppercase tracking-[-0.01em] text-[var(--clay-muted)]">
                  Danh sách chức vụ
                </p>
                <div className="mt-4 space-y-3">
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
              </Panel>
            )}
          </div>

          <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Panel>
              <p className="text-lg font-semibold tracking-[-0.01em] text-[var(--clay-text)]">
                Hành động
              </p>

              {!accessToken && (
                <div
                  role="alert"
                  className="mt-3 rounded-[12px] border border-[var(--state-danger)] bg-[var(--state-danger-soft)] p-3 text-sm leading-6 text-[var(--state-danger)]"
                >
                  Bạn cần đăng nhập tài khoản thường trước. Sau đó quay lại link QR này để tiếp tục
                  xác thực.
                </div>
              )}

              {!activeToken && publicInvite && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm leading-6 text-[var(--clay-muted)]">
                    QR chung chỉ mở roster. Hệ thống gửi OTP đến đúng email trong danh sách để chống
                    nhận nhầm suất bầu.
                  </p>
                  <Field label="Email trong roster">
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
                  <Field label="Mã sinh viên / mã nội bộ" hint="Tùy chọn">
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

              <div className="mt-4 space-y-2.5">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={() => void handleSendOtp()}
                  disabled={!canSendOtp || working}
                  loading={working && status === 'otp-required'}
                >
                  Gửi OTP đến email cử tri
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={() => void handleBindWallet()}
                  disabled={!canBindWallet || working}
                  loading={working && otpDone}
                  iconLeft={<Wallet className="h-4 w-4" aria-hidden="true" />}
                >
                  Bind MetaMask
                </Button>
              </div>

              {otpDevCode && (
                <div className="mt-3 rounded-[12px] border border-[var(--state-warning)] bg-[var(--state-warning-soft)] px-4 py-3 text-sm text-[var(--state-warning)]">
                  Dev OTP preview: <strong>{otpDevCode}</strong>
                </div>
              )}
              {invite?.walletAddress && (
                <div className="mt-3 break-all rounded-[12px] border border-[var(--state-success)] bg-[var(--state-success-soft)] px-4 py-3 text-sm text-[var(--state-success)]">
                  Ví đã bind: {invite.walletAddress}
                </div>
              )}
            </Panel>

            <Panel>
              <p className="text-sm font-semibold text-[var(--clay-text)]">Checklist</p>
              <ul className="mt-3 space-y-2 text-sm text-[var(--clay-muted)]">
                <li>1. Đăng nhập bằng tài khoản thường.</li>
                <li>2. Gửi OTP và nhập OTP từ email được mời.</li>
                <li>3. Kết nối MetaMask ở mạng Sepolia.</li>
                <li>4. Ký message để bind ví vào roster.</li>
                <li>5. Chờ admin deploy ballot từ danh sách đã xác thực.</li>
              </ul>
              <div className="mt-4 flex flex-col gap-2">
                <Link
                  to={loginRedirect}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-[var(--clay-primary)] px-4 text-sm text-[var(--clay-primary)] hover:bg-[var(--clay-primary-light)]"
                >
                  Đăng nhập tài khoản thường
                </Link>
                <Link
                  to="/app/elections"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-[var(--clay-border)] px-4 text-sm text-[var(--clay-text)] hover:bg-[var(--clay-surface-soft)]"
                >
                  Mở danh sách bầu cử
                </Link>
              </div>
            </Panel>
          </div>
        </div>
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
