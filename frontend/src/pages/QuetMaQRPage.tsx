'use client';

import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import jsQR from 'jsqr';
import { Button, Panel, StatusBadge, fieldControlClass } from '../components/ui/clay';
import {
  AlertTriangle,
  ArrowRight,
  ImageIcon,
  Link2,
  QrCode,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import Html5QrcodeWrapper from '../components/Html5QrcodeWrapper';
import ModalOTP from '../components/ModalOTP';
import { xacThucPhieuMoi, thamGiaPhienBauCu } from '../store/slice/phieuMoiPhienBauCuSlice';
import { fetchPhienBauCuById } from '../store/slice/phienBauCuSlice';
import { fetchCuocBauCuById } from '../store/slice/cuocBauCuByIdSlice';
import { guiOtp, xacMinhOtp } from '../store/slice/maOTPSlice';
import type { RootState, AppDispatch } from '../store/store';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { clearState } from '../store/slice/phieuMoiPhienBauCuSlice';
import {
  buildVerifyTransactionPath,
  extractVerifyTransactionTarget,
  isTransactionHash,
} from '../utils/transactionVerification';
import { buildVoterVerificationPath, resolveScanQueryTarget } from '../utils/qrRouting';

type QRDataType = 'TEXT' | 'URL' | 'EMAIL' | 'PHONE' | 'SMS' | 'WIFI' | 'VCARD' | 'OTHER';

interface QRData {
  type: QRDataType;
  content: string;
}

// UX (spec 006/M1,M4): lấy message backend (gồm lockout OTP "Còn N lần thử"
// từ S2) thay vì nuốt lỗi / nối raw err.message.
function readableError(error: unknown, fallback: string): string {
  if (typeof error === 'string' && error.trim()) return error;
  const e = error as {
    response?: { data?: { Error?: string; message?: string } };
    payload?: { Error?: string; message?: string };
    message?: string;
  };
  return (
    e?.response?.data?.Error ||
    e?.response?.data?.message ||
    e?.payload?.Error ||
    e?.payload?.message ||
    (typeof e?.message === 'string' && e.message ? e.message : '') ||
    fallback
  );
}

const QuetMaQRPage: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState<QRData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualPayload, setManualPayload] = useState('');
  const [processingImage, setProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sdt, setSdt] = useState('');
  const [isValidating, setIsValidating] = useState(true);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);

  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const handledInitialQueryRef = useRef(false);

  const { phieuMoi, dangTai, loi } = useSelector((state: RootState) => state.phieuMoiPhienBauCu);
  const { cuocBauCu } = useSelector((state: RootState) => state.cuocBauCuById);
  const { guiOtpThanhCong, xacMinhOtpThanhCong } = useSelector((state: RootState) => state.maOTP);
  const user = useSelector((state: RootState) => state.dangNhapTaiKhoan.taiKhoan);

  useEffect(() => {
    if (handledInitialQueryRef.current) return;

    const target = resolveScanQueryTarget(searchParams);
    if (!target) return;

    handledInitialQueryRef.current = true;
    if (target.kind === 'redirect') {
      navigate(target.path, { replace: true });
      return;
    }

    setError(target.message);
    setIsValidating(true);
  }, [navigate, searchParams]);

  useEffect(() => {
    dispatch(clearState());
    if (phieuMoi) {
      setIsValidating(false);
      setError(null);
      dispatch(fetchPhienBauCuById(phieuMoi.phienBauCuId));
      dispatch(fetchCuocBauCuById(phieuMoi.cuocBauCuId));
    }
  }, [phieuMoi, dispatch]);

  useEffect(() => {
    if (loi) {
      handleError('Đã xảy ra lỗi khi quét mã QR. Vui lòng thử lại.', loi);
    }
  }, [loi]);

  const handleScan = (decodedText: string) => {
    processQRData(decodedText);
    setScanning(false);
    setError(null); // Reset error when scanning is successful
  };

  const handleError = (message: string, _error?: unknown) => {
    setError(message);
    setIsValidating(true); // Ẩn ô input khi có lỗi
    setProcessingImage(false);
  };

  const handleScannerError = (message: string) => {
    const normalized = message.toLowerCase();
    const cameraProblem =
      normalized.includes('permission') ||
      normalized.includes('notallowed') ||
      normalized.includes('camera') ||
      normalized.includes('device');

    if (cameraProblem) {
      handleError('Không mở được camera. Hãy cấp quyền camera hoặc tải ảnh QR lên để kiểm tra.');
    }
  };

  // Hàm tiền xử lý hình ảnh trước khi phân tích QR
  const preprocessImage = (img: HTMLImageElement): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');

    // Kích thước tối đa để xử lý (giảm kích thước ảnh quá lớn)
    const MAX_SIZE = 1000;
    let width = img.width;
    let height = img.height;

    // Tính toán tỷ lệ để giảm kích thước nếu cần
    if (width > MAX_SIZE || height > MAX_SIZE) {
      const ratio = width / height;
      if (width > height) {
        width = MAX_SIZE;
        height = Math.floor(width / ratio);
      } else {
        height = MAX_SIZE;
        width = Math.floor(height * ratio);
      }
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Vẽ hình ảnh với kích thước mới
    ctx.drawImage(img, 0, 0, width, height);

    return canvas;
  };

  // Hàm cố gắng lọc lỗi nhiễu, tăng độ tương phản và làm rõ hình ảnh
  const enhanceImage = (canvas: HTMLCanvasElement): HTMLCanvasElement => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Tăng độ tương phản và chuyển sang đen trắng để dễ nhận diện
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Tính giá trị grayscale
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Tăng độ tương phản (threshold đơn giản)
      const threshold = 120;
      const newValue = gray < threshold ? 0 : 255;

      data[i] = data[i + 1] = data[i + 2] = newValue;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setProcessingImage(true);
      setError(null);

      // Kiểm tra loại file
      if (!file.type.startsWith('image/')) {
        handleError('File không hợp lệ. Vui lòng chọn file hình ảnh.', 'Invalid file type');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const img = new Image();
          img.onload = () => {
            try {
              // Bước 1: Tiền xử lý hình ảnh
              const processedCanvas = preprocessImage(img);

              // Bước 2: Tăng cường chất lượng hình ảnh
              const enhancedCanvas = enhanceImage(processedCanvas);

              // Bước 3: Thử phân tích ở nhiều kích thước
              let code = null;
              const ctx = enhancedCanvas.getContext('2d');

              if (ctx) {
                const imageData = ctx.getImageData(
                  0,
                  0,
                  enhancedCanvas.width,
                  enhancedCanvas.height,
                );
                code = jsQR(imageData.data, imageData.width, imageData.height);

                // Nếu không thành công, thử các phương pháp khác
                if (!code) {
                  // Phương pháp 1: Đảo ngược màu sắc
                  const invertedData = new Uint8ClampedArray(imageData.data);
                  for (let i = 0; i < invertedData.length; i += 4) {
                    invertedData[i] = 255 - invertedData[i];
                    invertedData[i + 1] = 255 - invertedData[i + 1];
                    invertedData[i + 2] = 255 - invertedData[i + 2];
                  }
                  const invertedImageData = new ImageData(
                    invertedData,
                    imageData.width,
                    imageData.height,
                  );
                  ctx.putImageData(invertedImageData, 0, 0);
                  code = jsQR(invertedImageData.data, imageData.width, imageData.height);
                }
              }

              if (code) {
                processQRData(code.data);
                setProcessingImage(false);
              } else {
                // Nếu tất cả các phương pháp đều thất bại
                handleError(
                  'Không thể đọc mã QR từ ảnh. Vui lòng thử lại với ảnh khác hoặc ảnh có chất lượng tốt hơn.',
                  'QR code not found',
                );
              }
            } catch (err) {
              handleError('Lỗi khi xử lý hình ảnh. Vui lòng thử lại.', err);
            }
          };
          img.onerror = () => {
            handleError('Lỗi khi tải hình ảnh. Vui lòng thử lại.', 'Image load error');
          };
          img.src = e.target?.result as string;
        } catch (err) {
          handleError('Lỗi khi đọc file. Vui lòng thử lại.', err);
        }
      };
      reader.onerror = () => {
        handleError('Lỗi khi đọc file. Vui lòng thử lại.', 'File read error');
      };
      reader.readAsDataURL(file);
    }
  };

  const processQRData = (data: string) => {
    try {
      let type: QRDataType = 'TEXT';
      const trimmedData = data.trim();

      if (trimmedData.startsWith('http://') || trimmedData.startsWith('https://')) {
        type = 'URL';
      } else if (trimmedData.startsWith('mailto:')) {
        type = 'EMAIL';
      } else if (trimmedData.startsWith('tel:')) {
        type = 'PHONE';
      } else if (trimmedData.startsWith('sms:')) {
        type = 'SMS';
      } else if (trimmedData.startsWith('WIFI:')) {
        type = 'WIFI';
      } else if (trimmedData.startsWith('BEGIN:VCARD')) {
        type = 'VCARD';
      }

      setScannedData({ type, content: trimmedData });

      if (type === 'URL') {
        try {
          const url = new URL(trimmedData);

          const verificationTarget = extractVerifyTransactionTarget(url);
          if (verificationTarget) {
            navigate(buildVerifyTransactionPath(verificationTarget.txHash, verificationTarget.chainId));
            return;
          }

          const tokenParam = url.searchParams.get('token');
          const groupKeyParam = url.searchParams.get('groupKey');
          const isElectionV1Invite = url.pathname.includes('/verify-voter');
          if (groupKeyParam && isElectionV1Invite) {
            navigate(buildVoterVerificationPath({ groupKey: groupKeyParam }));
            return;
          }

          if (tokenParam) {
            if (isElectionV1Invite) {
              navigate(buildVoterVerificationPath({ token: tokenParam }));
              return;
            }

            setToken(tokenParam);

            dispatch(xacThucPhieuMoi(tokenParam))
              .unwrap()
              .then(() => {
                setIsValidating(false);
                setError(null);
              })
              .catch((err) => {
                handleError(readableError(err, 'Lỗi xác thực mã mời. Vui lòng thử lại.'), err);
              });
          } else {
            // Thử phương pháp thay thế để tìm token
            // Kiểm tra xem URL có chứa `/invite/` hoặc mẫu tương tự không
            const urlParts = url.pathname.split('/');
            const possibleToken = urlParts[urlParts.length - 1];

            if (possibleToken && possibleToken.length > 10) {
              if (isElectionV1Invite) {
                navigate(buildVoterVerificationPath({ token: possibleToken }));
                return;
              }

              setToken(possibleToken);

              dispatch(xacThucPhieuMoi(possibleToken))
                .unwrap()
                .then(() => {
                  setIsValidating(false);
                  setError(null);
                })
                .catch(() => {
                  setError('Không tìm thấy mã mời hợp lệ trong URL.');
                  setIsValidating(true);
                });
            } else {
              setError('Không tìm thấy mã mời hợp lệ trong URL.');
              setIsValidating(true);
            }
          }
        } catch (urlError) {
          // Nếu URL không hợp lệ, kiểm tra xem dữ liệu có phải là token trực tiếp không
          if (isTransactionHash(trimmedData)) {
            navigate(buildVerifyTransactionPath(trimmedData));
            return;
          }

          if (trimmedData.length > 10 && !trimmedData.includes(' ')) {
            setToken(trimmedData);

            dispatch(xacThucPhieuMoi(trimmedData))
              .unwrap()
              .then(() => {
                setIsValidating(false);
                setError(null);
              })
              .catch(() => {
                setError('Mã QR không chứa URL hợp lệ hoặc mã mời.');
                setIsValidating(true);
              });
          } else {
            setError('URL trong mã QR không hợp lệ.');
            setIsValidating(true);
          }
        }
      } else {
        // Thử xem dữ liệu văn bản có phải là token trực tiếp không
        if (isTransactionHash(trimmedData)) {
          navigate(buildVerifyTransactionPath(trimmedData));
          return;
        }

        if (trimmedData.length > 10 && !trimmedData.includes(' ')) {
          setToken(trimmedData);

          dispatch(xacThucPhieuMoi(trimmedData))
            .unwrap()
            .then(() => {
              setIsValidating(false);
              setError(null);
            })
            .catch(() => {
              setError('Mã QR không chứa mã mời hợp lệ.');
              setIsValidating(true);
            });
        } else {
          setError('Mã QR không hợp lệ. Hãy quét mã QR từ hệ thống HoLiHu Blockchain.');
          setIsValidating(true);
        }
      }
    } catch (err) {
      handleError('Lỗi khi xử lý dữ liệu mã QR.', err);
    }
  };

  const handleJoin = async () => {
    if (token && user?.email) {
      try {
        setIsOtpModalOpen(true);
        await dispatch(guiOtp(user.email)).unwrap();
      } catch (error) {
        handleError('Đã xảy ra lỗi khi gửi OTP.', error);
      }
    }
  };

  const handleVerifyOtp = async (otp: string) => {
    if (token && user?.email) {
      try {
        const response = await dispatch(xacMinhOtp({ email: user.email, otp })).unwrap();
        if (response.success) {
          await handleThamGiaPhienBauCu();
        } else {
          setOtpError(readableError(response, 'Mã OTP không hợp lệ. Vui lòng thử lại.'));
        }
      } catch (error) {
        setOtpError(readableError(error, 'Mã OTP không hợp lệ. Vui lòng thử lại.'));
      }
    }
  };

  const handleThamGiaPhienBauCu = async () => {
    if (token) {
      try {
        await dispatch(thamGiaPhienBauCu({ token, sdt })).unwrap();
        toast.success('Tham gia phiên bầu cử thành công!');
        setIsOtpModalOpen(false);
        setTimeout(() => {
          navigate(`/app/elections/${phieuMoi?.cuocBauCuId}`);
        }, 2000);
      } catch (error) {
        handleError('Đã xảy ra lỗi khi tham gia phiên bầu cử.', error);
      }
    }
  };

  const handleResendOtp = () => {
    if (user?.email) {
      dispatch(guiOtp(user.email))
        .unwrap()
        .catch((error) => handleError('Đã xảy ra lỗi khi gửi OTP.', error));
    }
  };

  const handleManualSubmit = () => {
    const value = manualPayload.trim();
    if (!value) {
      setError('Hãy dán đường dẫn QR, mã mời hoặc mã giao dịch trước khi kiểm tra.');
      return;
    }

    processQRData(value);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 text-[var(--clay-text)]">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase text-[var(--clay-muted)]">Cửa vào QR</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold tracking-[-0.015em] text-[var(--clay-text)]">
          Quét mã QR
        </h1>
        <p className="mt-1 max-w-2xl text-[15px] leading-6 text-[var(--clay-muted)]">
          Dùng cho QR mời cử tri để xác thực OTP, hoặc QR/mã giao dịch để kiểm chứng giao dịch trên Sepolia.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
        <Panel>
          {scanning ? (
            <div>
              <Html5QrcodeWrapper
                fps={10}
                qrbox={Math.max(250, 50)}
                disableFlip={false}
                verbose={false}
                onScan={handleScan}
                onError={handleScannerError}
              />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  iconLeft={<ImageIcon className="h-4 w-4" aria-hidden="true" />}
                >
                  Quét ảnh có sẵn
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setScanning(false)}
                  iconLeft={<QrCode className="h-4 w-4" aria-hidden="true" />}
                >
                  Đóng quét
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => setScanning(true)}
                disabled={processingImage}
                iconLeft={<QrCode className="h-4 w-4" aria-hidden="true" />}
              >
                Bắt đầu quét
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={processingImage}
                loading={processingImage}
                iconLeft={<Upload className="h-4 w-4" aria-hidden="true" />}
              >
                {processingImage ? 'Đang xử lý ảnh…' : 'Tải lên ảnh mã QR'}
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept="image/*"
                className="hidden"
                disabled={processingImage}
              />
            </div>
          )}

          <div className="mt-5 rounded-[14px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-4">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[var(--clay-primary)]" aria-hidden="true" />
              <p className="text-sm font-semibold text-[var(--clay-text)]">Không dùng được camera?</p>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={manualPayload}
                onChange={(event) => setManualPayload(event.target.value)}
                className={fieldControlClass}
                placeholder="Dán link /verify-voter, link Etherscan hoặc mã giao dịch..."
                aria-label="Dán nội dung QR hoặc mã giao dịch"
              />
              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={handleManualSubmit}
                iconRight={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
              >
                Kiểm tra
              </Button>
            </div>
          </div>

          {scannedData && (
            <div className="mt-4 rounded-[14px] border border-[var(--clay-border)] bg-[var(--clay-surface-soft)] p-4">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-sm font-semibold text-[var(--clay-text)]">Thông tin mã QR</p>
                <StatusBadge tone="info">{scannedData.type}</StatusBadge>
              </div>
              <p className="break-words text-sm text-[var(--clay-muted)]">{scannedData.content}</p>
              {token && !isValidating && !error && (
                <div className="mt-4 space-y-3">
                  {cuocBauCu && (
                    <div className="space-y-1 text-sm text-[var(--clay-muted)]">
                      <p>
                        <strong className="text-[var(--clay-text)]">Cuộc bầu cử:</strong>{' '}
                        {cuocBauCu.tenCuocBauCu}
                      </p>
                      <p>
                        <strong className="text-[var(--clay-text)]">Bắt đầu:</strong>{' '}
                        {cuocBauCu.ngayBatDau}
                      </p>
                      <p>
                        <strong className="text-[var(--clay-text)]">Kết thúc:</strong>{' '}
                        {cuocBauCu.ngayKetThuc}
                      </p>
                    </div>
                  )}
                  <input
                    type="tel"
                    placeholder="Số điện thoại"
                    value={sdt}
                    onChange={(e) => setSdt(e.target.value)}
                    className={fieldControlClass}
                    aria-label="Số điện thoại"
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={handleJoin}
                    disabled={dangTai || !sdt}
                    loading={dangTai}
                  >
                    Tham gia
                  </Button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mt-4 flex items-center gap-2 rounded-[12px] border border-[var(--state-danger)] bg-[var(--state-danger-soft)] p-3 text-sm text-[var(--state-danger)]"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </div>
          )}
        </Panel>
        </div>

        <aside className="space-y-4">
          <Panel className="p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--clay-primary)]" aria-hidden="true" />
              <p className="text-sm font-semibold text-[var(--clay-text)]">Mã được hỗ trợ</p>
            </div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-[var(--clay-muted)]">
              <div className="rounded-[12px] border border-[var(--clay-border)] bg-[var(--clay-surface)] p-3">
                <p className="font-semibold text-[var(--clay-text)]">QR mời cử tri</p>
                <p>Mở luồng xác minh OTP và liên kết MetaMask trước khi bỏ phiếu.</p>
              </div>
              <div className="rounded-[12px] border border-[var(--clay-border)] bg-[var(--clay-surface)] p-3">
                <p className="font-semibold text-[var(--clay-text)]">QR giao dịch</p>
                <p>Mở trang kiểm chứng HoLiHu, sau đó có thể đối chiếu thêm trên Etherscan.</p>
              </div>
            </div>
          </Panel>

          <Panel className="p-4">
            <p className="text-sm font-semibold text-[var(--clay-text)]">Sau khi quét</p>
            <ol className="mt-3 space-y-2 text-sm leading-6 text-[var(--clay-muted)]">
              <li>1. QR mời chuyển sang trang xác minh cử tri.</li>
              <li>2. Cử tri nhận OTP qua email trong danh sách.</li>
              <li>3. Sau OTP, cử tri liên kết đúng ví MetaMask để được đưa vào danh sách cử tri.</li>
            </ol>
          </Panel>
        </aside>
      </div>

      <ModalOTP
        isOpen={isOtpModalOpen}
        onClose={() => setIsOtpModalOpen(false)}
        onVerify={handleVerifyOtp}
        email={user?.email || ''}
        onResend={handleResendOtp}
        error={otpError}
      />
    </div>
  );
};

export default QuetMaQRPage;
