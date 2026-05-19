# Phase 1 — Model: Surface map, component reuse, logic-preservation

UX feature → "entities" = bản đồ trang công khai + component tái dùng + handler phải bảo toàn.

## 1. Surface & lát cắt

| Surface | Trang | Lát | Logic giữ verbatim |
|---|---|---|---|
| Vỏ | AppBeforeLogin, Header, Footer | US1 | (không logic nghiệp vụ; chỉ a11y/nav state) |
| Landing | ChaoMungPage | US1 | — (marketing thuần) |
| Auth | LoginPage | US2 🔒 | getRecaptchaToken/handleAutoLogin/handleCredentialsLogin/handleMetaMaskLogin |
| Auth | DangKyTaiKhoanPage | US2 🔒 | handleSave (+ KHÔNG đụng NewAccountForm) |
| OTP | TimTaiKhoanPage, GuiOTPPage, DatLaiMatKhauPage | US2 🔒 | hàm tìm tài khoản / gửi+xác minh OTP / đặt lại mật khẩu |
| Marketing | CacCuocBauCuPage, FaqPage, LienHe, CamOnPage | US3 | LienHe: react-hook-form + Redux submit giữ; CacCuocBauCu: Redux fetch giữ |
| Pháp lý | ChinhSachBaoMatPage, DieuKhoanSuDungPage | US4 | scroll/ToC/animation giữ; chỉ đồng bộ token |

## 2. Component clay tái dùng (Đợt 10)

`Button, Field, fieldControlClass, Panel, SectionCard, StatusBadge, Tabs, Stepper, Wizard, DataTable, Pagination, DropdownButton, Breadcrumb, PageHeader, SummaryRail, EmptyState, Loader, Skeleton, notify`.
**Bổ sung nếu thiếu**: `Accordion` (FAQ — US3, Radix accordion).

Ràng buộc: target ≥44px, focus-visible, ARIA/label, radius/clay tokens, 0 màu hardcode/gradient tự chế, 1 hệ toast (`notify`).

## 3. Logic-preservation map (lift JSX, keep logic)

- **LoginPage** (~659 dòng): giữ toàn bộ state + 4 handler bảo mật + tab credentials/MetaMask state; chỉ thay JSX 2 cột → clay Panel/Field/Button/StatusBadge/Stepper(MetaMask steps). ID/aria giữ.
- **DangKyTaiKhoanPage** (~378): giữ `handleSave`, success dialog state; thay vỏ + benefits bằng clay; `<NewAccountForm onSave={handleSave}/>` render y nguyên (không sửa props/component).
- **TimTaiKhoan/GuiOTP/DatLaiMatKhau**: giữ handler; bọc bằng clay Field/Button, lỗi inline; OTP qua input hiện có (không echo).
- **LienHe** (~508): giữ react-hook-form + `lienHeSlice` dispatch; thay field/button/alert bằng clay Field/Button/StatusBadge.
- **CacCuocBauCuPage** (~71): giữ Redux fetch; thay grid + ElectionCard wrapper bằng clay Panel + EmptyState/Loader.
- **FaqPage** (~230): giữ data + openIndex; dùng clay Accordion.
- **CamOnPage** (~64): clay Panel/Button.
- **ChaoMung** (~219): clay section/Button (đã gần Apple-like; chuẩn hoá token).
- **Header/Footer**: clay token + a11y; giữ search/UserMenu/newsletter logic.
- **Legal ×2**: chỉ thay class màu/chữ → token clay; KHÔNG đụng framer-motion scroll/ToC; verify `scrollHeight` không tăng.

## 4. Định nghĩa "Done" / lát

PASS khi: (a) acceptance scenario spec đạt; (b) `npm run typecheck:active` = 0 (đã include trang đó); (c) luồng quickstart tương ứng không hồi quy; (d) 0 secret/legacy-growth/lib; (e) lát US2: POST-diff các trang nhạy cảm khớp `auth-otp-reference.md` (0 dòng handler/recaptcha/OTP trong diff).
