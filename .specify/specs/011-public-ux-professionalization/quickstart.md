# Quickstart — Verify Đợt 11

Môi trường: Node 20/22 LTS, `cd frontend && npm install --legacy-peer-deps && npm run dev`.

## A. Quality gate (mỗi lát + trước commit)

| Gate | Lệnh | PASS khi |
|---|---|---|
| Type | `cd frontend && npm run typecheck:active` | 0 lỗi (đã include trang đang làm) |
| Secret | rà `git diff` | không key/secret/OTP mới |
| Legacy/lib | rà diff | không sửa `src/test/**`, `NewAccountForm`, Redux/BE; `package.json` không thêm lib UI |
| Auth/OTP verbatim | `git diff HEAD -- <trang nhạy cảm>` | chỉ hunk import + JSX; **0 dòng** handler/`executeRecaptcha`/`personal_sign`/`registerAccount`/`login(`/`loginWithMetaMask`/`refreshJwtToken`/`resetSecurityState`/`clearAllAccessCache`/OTP-verify trong diff (đối chiếu `auth-otp-reference.md`) |

## B. Luồng không hồi quy (SC-003)

1. **Đăng nhập mật khẩu** (`/login`): sai → lỗi rõ; đúng → vào app như cũ.
2. **Đăng nhập MetaMask** (`/login`): connect → ký nonce `personal_sign` → vào app; huỷ ký → lỗi rõ.
3. **Đăng ký** (`/register`): submit `NewAccountForm` → `registerAccount`+recaptcha → dialog ví/token.
4. **Khôi phục mật khẩu**: tìm tài khoản → nhận/nhập OTP → đặt lại; OTP không echo/không plaintext (DevTools).
5. **Liên hệ** (`/lien-he`): validate + gửi (Redux) → thành công/lỗi rõ.
6. **Danh sách công khai** (`/elections`): tải/rỗng có trạng thái; thẻ dùng card chung.

## C. UX gates

| ID | Kiểm | PASS |
|---|---|---|
| SC-001 | grep trang công khai | 0 `gray-/blue-/sky-` ad-hoc & màu hardcode ở form/marketing; dùng clay |
| SC-002 | grep | 0 sweetalert2/sonner/react-toastify ở trang công khai |
| SC-005 | Tab-only + đọc màn hình | mọi control tới được, focus rõ, drawer Esc, ≥44px, AA |
| SC-006 | DevTools 1440×900 legal | `document.documentElement.scrollHeight` KHÔNG tăng vs trước; ToC dính + back-to-top OK |

## D. Thứ tự bàn giao
US1 (vỏ+landing) → US2 (auth+OTP, kèm verbatim gate) → US3 (marketing/nội dung) → US4 (legal token-sync). Mỗi lát: A + B liên quan + commit.
