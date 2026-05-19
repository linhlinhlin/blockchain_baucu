# Phase 0 — Research: Đợt 11

0 NEEDS CLARIFICATION (quyết định sản phẩm kế thừa Đợt 10, đã chốt). Quyết định kỹ thuật:

## D1 — Tái dùng nguyên lớp clay Đợt 10
- **Decision**: Dùng `src/components/ui/clay/*` (16 component) + `notify` y nguyên cho trang công khai. Token clay/state ở `index.css` đã có.
- **Rationale**: Đã verify (Đợt 10/10.1, tsc=0); nhất quán tức thì; 0 lib mới (Principle III).
- **Alternatives**: tạo bộ public riêng — thừa, mâu thuẫn hợp nhất.

## D2 — "Lift JSX, keep logic" + cổng verbatim auth/OTP (giống S4/S5)
- **Decision**: Mỗi trang chỉ thay JSX/vỏ; copy nguyên block logic/handler. Trang nhạy cảm (LoginPage, DangKyTaiKhoanPage, GuiOTPPage, DatLaiMatKhauPage, TimTaiKhoanPage): PRE pin verbatim → `auth-otp-reference.md`; POST `git diff` chỉ được chạm vùng JSX/import.
- **Rationale**: Mô hình S4/S5 Đợt 10 đã chứng minh an toàn (Principle I).
- **Alternatives**: viết lại form/logic — rủi ro hồi quy auth, cấm.

## D3 — Accordion clay cho FAQ
- **Decision**: Thêm `components/ui/clay/Accordion.tsx` trên `@radix-ui/react-accordion` (đã cài) nếu FaqPage cần; export qua barrel. Biện minh: plan Complexity Tracking.
- **Alternatives**: accordion tự chế trong trang — lặp layout (thứ Đợt 10 diệt).

## D4 — Cổng tsc: mở rộng tsconfig.active.json
- **Decision**: Thêm trang công khai + Header/Footer/AppBeforeLogin vào `include` của `tsconfig.active.json`; `npm run typecheck:active` = 0 là gate (không tăng so baseline Đợt 10.1).
- **Rationale**: Tái lập, đúng định nghĩa Hiến chương "active path clean".
- **Alternatives**: full `tsc` — chậm/contention + lỗi legacy ngoài import-graph (Principle III freeze, ngoài trách nhiệm).

## INV — Bất biến bảo mật (PRE pin ở `auth-otp-reference.md`, POST diff)

KHÔNG sửa nội dung/thứ tự các handler (chỉ được di chuyển JSX bao quanh):

- **LoginPage.tsx**: `getRecaptchaToken` (~104-120, `executeRecaptcha('login_page')`), `handleAutoLogin` (~122-147, `refreshJwtToken` → `resetSecurityState` → save user_data → fetch session → redirect), `handleCredentialsLogin` (~174-244, validate → recaptcha → `dispatch(login(...))` → `clearAllAccessCache` → `resetSecurityState` → save → redirect), `handleMetaMaskLogin` (~246-335, `connectWallet` → nonce → `window.ethereum.request personal_sign` → `dispatch(loginWithMetaMask(...))` → reset → save → redirect).
- **DangKyTaiKhoanPage.tsx**: `handleSave` (~52-77, recaptcha check → `dispatch(registerAccount({account, recaptchaToken}))` → trích ví). **KHÔNG đụng** `../features/TaoTaiKhoanForm` (NewAccountForm).
- **Khôi phục mật khẩu**: `TimTaiKhoanPage`, `GuiOTPPage`, `DatLaiMatKhauPage` — giữ verbatim hàm gửi/xác minh OTP & đặt lại; OTP không echo ra UI/console, không lưu plaintext localStorage nơi script chạm.

POST-gate mỗi trang nhạy cảm: `git diff HEAD -- <file>` chỉ gồm hunk import + JSX return; **0 dòng** tên handler trên / `executeRecaptcha` / `personal_sign` / `registerAccount` / `login(`/`loginWithMetaMask`/`refreshJwtToken`/`resetSecurityState`/`clearAllAccessCache` / OTP verify xuất hiện trong diff.

## Rủi ro & giảm thiểu
- Bề mặt: 3 vỏ + ~9 trang + 2 legal + 3 OTP. Không BE/Redux/contract/legacy.
- Rủi ro chính: hồi quy auth khi tái cấu trúc trang dài (LoginPage ~659). Giảm: PRE/POST verbatim gate + `typecheck:active`=0 + kiểm thử thao tác quickstart.
