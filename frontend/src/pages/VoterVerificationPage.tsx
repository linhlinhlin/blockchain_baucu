import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { CheckCircle, Loader2, Mail, ShieldCheck, Wallet, AlertTriangle } from 'lucide-react';
import ModalOTP from '../components/ModalOTP';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
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

  const statusTone = useMemo(() => {
    if (status === 'error') {
      return 'border-[rgba(252,121,129,0.28)] bg-[rgba(252,121,129,0.18)] text-[var(--clay-text)]';
    }
    if (status === 'wallet-bound' || status === 'deployed') {
      return 'border-[rgba(132,231,165,0.28)] bg-[rgba(132,231,165,0.18)] text-[var(--clay-text)]';
    }
    return 'border-[rgba(59,211,253,0.28)] bg-[rgba(59,211,253,0.16)] text-[var(--clay-text)]';
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

  return (
    <div className="min-h-screen bg-[var(--clay-canvas)] px-4 py-8 text-[var(--clay-text)]">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1.15fr)_360px]">
        <Card className="clay-panel border-0 bg-transparent shadow-none">
          <CardHeader className="px-0 pt-0">
            <div className="clay-badge bg-[rgba(59,211,253,0.2)]">
              <ShieldCheck className="h-3.5 w-3.5" />
              QR / OTP onboarding
            </div>
            <CardTitle className="mt-4 text-3xl font-extrabold tracking-[-0.04em] text-black">
              Xác thực cử tri và bind MetaMask cho ElectionV1
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 px-0 pb-0">
            <div
              role={status === 'error' ? 'alert' : 'status'}
              aria-live={status === 'error' ? 'assertive' : 'polite'}
              aria-atomic="true"
              className={`rounded-[28px] border px-5 py-4 ${statusTone}`}
            >
              <div className="flex items-start gap-3">
                {status === 'loading' ? (
                  <Loader2
                    className="mt-0.5 h-5 w-5 animate-spin text-[var(--clay-text)]"
                    aria-hidden="true"
                  />
                ) : status === 'wallet-bound' ? (
                  <CheckCircle
                    className="mt-0.5 h-5 w-5 text-[var(--clay-text)]"
                    aria-hidden="true"
                  />
                ) : status === 'error' ? (
                  <AlertTriangle
                    className="mt-0.5 h-5 w-5 text-[var(--clay-text)]"
                    aria-hidden="true"
                  />
                ) : (
                  <Mail className="mt-0.5 h-5 w-5 text-[var(--clay-text)]" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="font-semibold text-black">Trạng thái hiện tại</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--clay-text)]">{message}</p>
                </div>
              </div>
            </div>

            {invite && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[28px] border border-[var(--clay-border)] bg-[rgba(255,255,255,0.82)] p-5 shadow-[var(--clay-shadow)]">
                  <p className="clay-label">Cử tri</p>
                  <p className="mt-2 text-xl font-bold text-black">{invite.fullName}</p>
                  <p className="mt-2 text-sm text-[var(--clay-muted)]">{invite.emailMasked}</p>
                  {invite.studentCode && (
                    <p className="text-sm text-[var(--clay-muted)]">MSSV: {invite.studentCode}</p>
                  )}
                </div>

                <div className="rounded-[28px] border border-[var(--clay-border)] bg-[rgba(255,255,255,0.82)] p-5 shadow-[var(--clay-shadow)]">
                  <p className="clay-label">Ballot</p>
                  <p className="mt-2 text-xl font-bold text-black">{invite.ballotTitle}</p>
                  <p className="mt-2 text-sm text-[var(--clay-muted)]">
                    Commit: {new Date(invite.commitStart).toLocaleString('vi-VN')}
                  </p>
                  <p className="text-sm text-[var(--clay-muted)]">
                    Reveal: {new Date(invite.revealEnd).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>
            )}

            {!invite && publicInvite && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[28px] border border-[var(--clay-border)] bg-[rgba(255,255,255,0.82)] p-5 shadow-[var(--clay-shadow)]">
                  <p className="clay-label">Roster chung</p>
                  <p className="mt-2 text-xl font-bold text-black">{publicInvite.ballotTitle}</p>
                  <p className="mt-2 text-sm text-[var(--clay-muted)]">
                    {publicInvite.totalInviteCount} cử tri trong roster
                  </p>
                </div>

                <div className="rounded-[28px] border border-[var(--clay-border)] bg-[rgba(255,255,255,0.82)] p-5 shadow-[var(--clay-shadow)]">
                  <p className="clay-label">Tiến độ</p>
                  <p className="mt-2 text-sm text-[var(--clay-muted)]">
                    OTP verified: {publicInvite.otpVerifiedCount}
                  </p>
                  <p className="text-sm text-[var(--clay-muted)]">
                    Wallet bound: {publicInvite.walletBoundCount}
                  </p>
                  <p className="mt-2 text-sm text-[var(--clay-muted)]">
                    Reveal: {new Date(publicInvite.revealEnd).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>
            )}

            {(invite || publicInvite) && (
              <div className="rounded-[28px] border border-[var(--clay-border)] bg-[rgba(255,255,255,0.9)] p-5 shadow-[var(--clay-shadow)]">
                <p className="clay-label">Danh sách chức vụ</p>
                <div className="mt-4 space-y-3">
                  {(invite?.positions ?? publicInvite?.positions ?? []).map((position) => (
                    <div
                      key={position.positionId}
                      className="rounded-[22px] border border-[var(--clay-border-light)] bg-[rgba(250,249,247,0.96)] p-4"
                    >
                      <p className="font-semibold text-black">{position.title}</p>
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
            )}
          </CardContent>
        </Card>

        <Card className="clay-panel border-0 bg-transparent shadow-none">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-2xl font-bold tracking-[-0.03em] text-black">
              Hành động
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-0 pb-0">
            {!accessToken && (
              <div
                role="alert"
                className="rounded-[28px] border border-[rgba(252,121,129,0.28)] bg-[rgba(252,121,129,0.18)] p-4 text-sm leading-6 text-[var(--clay-text)]"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className="mt-0.5 h-5 w-5 shrink-0 text-[#8a1f17]"
                    aria-hidden="true"
                  />
                  <p className="min-w-0">
                    Bạn cần đăng nhập tài khoản thường trước. Sau đó quay lại link QR này để tiếp
                    tục xác thực.
                  </p>
                </div>
              </div>
            )}

            {!activeToken && publicInvite && (
              <div className="rounded-[28px] border border-[var(--clay-border)] bg-white p-4">
                <p className="font-semibold text-black">Xác định cử tri</p>
                <p className="mt-1 text-sm leading-6 text-[var(--clay-muted)]">
                  QR chung chỉ mở roster. Hệ thống sẽ gửi OTP đến đúng email trong danh sách để
                  chống nhận nhầm suất bầu.
                </p>
                <label
                  className="mt-4 block text-sm font-semibold text-black"
                  htmlFor="roster-email"
                >
                  Email trong roster
                </label>
                <input
                  id="roster-email"
                  type="email"
                  value={identityEmail}
                  onChange={(event) => setIdentityEmail(event.target.value)}
                  className="clay-input mt-2 min-h-11 px-4 py-3 text-sm"
                  placeholder="name@example.com"
                  autoComplete="email"
                />
                <label
                  className="mt-4 block text-sm font-semibold text-black"
                  htmlFor="roster-student-code"
                >
                  Mã sinh viên / mã nội bộ
                </label>
                <input
                  id="roster-student-code"
                  value={identityStudentCode}
                  onChange={(event) => setIdentityStudentCode(event.target.value)}
                  className="clay-input mt-2 min-h-11 px-4 py-3 text-sm"
                  placeholder="Tùy chọn"
                  autoComplete="off"
                />
              </div>
            )}

            <Button
              onClick={() => void handleSendOtp()}
              disabled={!canSendOtp || working}
              className="w-full"
            >
              {working && status === 'otp-required' ? 'Đang gửi OTP…' : 'Gửi OTP đến email cử tri'}
            </Button>

            <Button
              onClick={() => void handleBindWallet()}
              disabled={!canBindWallet || working}
              variant="outline"
              className="w-full"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {working ? 'Đang bind wallet…' : 'Bind MetaMask'}
            </Button>

            {otpDevCode && (
              <div className="rounded-[24px] border border-[rgba(248,204,101,0.45)] bg-[rgba(248,204,101,0.18)] px-4 py-3 text-sm text-black">
                Dev OTP preview: <strong>{otpDevCode}</strong>
              </div>
            )}

            {invite?.walletAddress && (
              <div className="rounded-[24px] border border-[rgba(132,231,165,0.24)] bg-[rgba(132,231,165,0.16)] px-4 py-3 text-sm break-all text-black">
                Ví đã bind: {invite.walletAddress}
              </div>
            )}

            <div className="rounded-[28px] border border-[var(--clay-border)] bg-[rgba(255,255,255,0.82)] p-4 text-sm leading-6 text-[var(--clay-muted)]">
              <p className="font-semibold text-black">Checklist</p>
              <ul className="mt-3 space-y-2">
                <li>1. Đăng nhập bằng tài khoản thường.</li>
                <li>2. Gửi OTP và nhập OTP từ email được mời.</li>
                <li>3. Kết nối MetaMask ở mạng Sepolia.</li>
                <li>4. Ký message để bind ví vào roster.</li>
                <li>5. Chờ admin deploy ballot từ danh sách đã xác thực.</li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <Link to={loginRedirect} className="w-full">
                <Button variant="outline" className="w-full">
                  Đăng nhập tài khoản thường
                </Button>
              </Link>
              <Link to="/app/user-elections" className="w-full">
                <Button variant="outline" className="w-full">
                  Mở danh sách ballot
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
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
