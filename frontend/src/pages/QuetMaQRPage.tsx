'use client';

import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import jsQR from 'jsqr';
import { Button, Panel, StatusBadge, fieldControlClass } from '../components/ui/clay';
import { AlertTriangle, Upload, QrCode, ImageIcon } from 'lucide-react';
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
  const [processingImage, setProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sdt, setSdt] = useState('');
  const [isValidating, setIsValidating] = useState(true);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);

  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { phieuMoi, dangTai, loi } = useSelector((state: RootState) => state.phieuMoiPhienBauCu);
  const { cuocBauCu } = useSelector((state: RootState) => state.cuocBauCuById);
  const { guiOtpThanhCong, xacMinhOtpThanhCong } = useSelector((state: RootState) => state.maOTP);
  const user = useSelector((state: RootState) => state.dangNhapTaiKhoan.taiKhoan);

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

  const handleError = (message: string, error: any) => {
    console.error('QR Error:', error);
    setError(message);
    setIsValidating(true); // Ẩn ô input khi có lỗi
    setProcessingImage(false);
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

      // Nhật ký dữ liệu đầu vào để gỡ lỗi
      console.log('QR Data content:', trimmedData);

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
          console.log('URL parsed:', url.toString());
          console.log('URL params:', Array.from(url.searchParams.entries()));

          const verificationTarget = extractVerifyTransactionTarget(url);
          if (verificationTarget) {
            navigate(buildVerifyTransactionPath(verificationTarget.txHash, verificationTarget.chainId));
            return;
          }

          const tokenParam = url.searchParams.get('token');
          const groupKeyParam = url.searchParams.get('groupKey');
          const isElectionV1Invite = url.pathname.includes('/verify-voter');
          if (groupKeyParam && isElectionV1Invite) {
            navigate(`/verify-voter?groupKey=${encodeURIComponent(groupKeyParam)}`);
            return;
          }

          if (tokenParam) {
            if (isElectionV1Invite) {
              navigate(`/verify-voter?token=${encodeURIComponent(tokenParam)}`);
              return;
            }

            setToken(tokenParam);
            console.log('Token found:', tokenParam);

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
              console.log('Trying alternative token from path:', possibleToken);
              if (isElectionV1Invite) {
                navigate(`/verify-voter?token=${encodeURIComponent(possibleToken)}`);
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
          console.error('URL parsing error:', urlError);

          // Nếu URL không hợp lệ, kiểm tra xem dữ liệu có phải là token trực tiếp không
          if (isTransactionHash(trimmedData)) {
            navigate(buildVerifyTransactionPath(trimmedData));
            return;
          }

          if (trimmedData.length > 10 && !trimmedData.includes(' ')) {
            console.log('Trying direct token:', trimmedData);
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
          console.log('Trying direct token from text:', trimmedData);
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

  return (
    <div className="flex min-h-[70vh] items-start justify-center px-4 py-8 text-[var(--clay-text)]">
      <div className="w-full max-w-md">
        <div className="mb-5 text-center">
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.015em] text-[var(--clay-text)]">
            Quét mã QR
          </h1>
          <p className="mt-1 text-[15px] text-[var(--clay-muted)]">
            Quét hoặc tải lên mã QR mời để tham gia phiên bầu cử.
          </p>
        </div>
        <Panel>
          {scanning ? (
            <div>
              <Html5QrcodeWrapper
                fps={10}
                qrbox={Math.max(250, 50)}
                disableFlip={false}
                verbose={false}
                onScan={handleScan}
                onError={handleError}
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
