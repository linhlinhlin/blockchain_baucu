# Feature Specification: Đợt 11 — Chuyên nghiệp hoá UX/UI trang công khai (pre-login)

**Feature Branch**: `011-public-ux-professionalization`
**Created**: 2026-05-19
**Status**: Draft
**Input**: Tái dùng lớp `clay` của Đợt 10 để chuẩn hoá toàn bộ trang công khai/marketing (pre-login) cho nhất quán, chuyên nghiệp; bảo toàn verbatim luồng auth/recaptcha/OTP. Nguồn sự thật: `docs/audit/AUDIT_2026-05-18.md`, `docs/audit/REMEDIATION_DOT10.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Vỏ công khai & trang chủ nhất quán (Priority: P1)

Khách truy cập chưa đăng nhập vào trang chủ và duyệt các trang công khai: header/footer/khung nhất quán theo hệ Apple-like sáng, điều hướng rõ, responsive (hamburger/drawer a11y), trang chủ trình bày giá trị sản phẩm gọn gàng, chuyên nghiệp — không lẫn lộn màu/kiểu tự chế.

**Why this priority**: Đây là ấn tượng đầu và nền tảng dùng chung cho mọi trang công khai; làm vỏ + landing trước thì các trang sau kế thừa nhất quán.

**Independent Test**: Mở `/` rồi duyệt qua các trang công khai: header/footer đồng nhất, trạng thái điều hướng đúng, thu nhỏ về mobile thì menu chuyển hamburger/drawer đóng/mở được (Esc/nền), target ≥44px; không chức năng nào mất.

**Acceptance Scenarios**:

1. **Given** khách ở bất kỳ trang công khai nào, **When** quan sát header/footer, **Then** chúng dùng cùng token clay (màu/chữ/khoảng cách/bo góc), không màu hardcode/gradient tự chế.
2. **Given** màn hình < ngưỡng mobile, **When** mở menu điều hướng, **Then** drawer/hamburger hoạt động, đóng bằng nút/nền/Esc, mọi mục chạm được (≥44px).
3. **Given** dùng bàn phím, **When** Tab qua header/landing, **Then** có vòng focus rõ, có liên kết "bỏ qua tới nội dung".

---

### User Story 2 - Form xác thực & khôi phục mật khẩu chuyên nghiệp (Priority: P1)

Người dùng đăng nhập (mật khẩu hoặc MetaMask), đăng ký tài khoản, hoặc khôi phục mật khẩu (tìm tài khoản → OTP → đặt lại) qua các form trình bày chuyên nghiệp bằng component dùng chung (nhãn/gợi ý/lỗi/aria rõ, nút có trạng thái loading) — **mọi luồng auth/recaptcha/OTP hoạt động y như cũ**.

**Why this priority**: Cửa vào hệ thống, dùng nhiều nhất, và nhạy cảm bảo mật — phải vừa chuyên nghiệp vừa không hồi quy.

**Independent Test**: Đăng nhập bằng mật khẩu & bằng MetaMask; đăng ký 1 tài khoản; chạy luồng quên mật khẩu (tìm tài khoản → nhận/nhập OTP → đặt lại). Kết quả auth/đăng ký/OTP giống hệt trước; lỗi hiển thị rõ tại chỗ; OTP không bị echo/không lưu plaintext nơi script chạm.

**Acceptance Scenarios**:

1. **Given** ở `/login`, **When** nhập sai mật khẩu / sai chữ ký ví, **Then** lỗi hiển thị rõ ràng bằng mẫu chung; nút có trạng thái loading; luồng `login`/`loginWithMetaMask`/nonce/recaptcha không đổi.
2. **Given** ở `/register`, **When** gửi form, **Then** `registerAccount` + recaptcha chạy như cũ; dialog kết quả (ví/token) hiển thị bằng component chung.
3. **Given** luồng khôi phục mật khẩu, **When** đi qua các bước, **Then** trình bày theo bước rõ ràng, lỗi tại chỗ, OTP an toàn (không echo/không plaintext nơi script chạm).

---

### User Story 3 - Trang nội dung/marketing nhất quán (Priority: P2)

Khách xem danh sách cuộc bầu cử công khai, FAQ, gửi liên hệ, và trang cảm ơn — tất cả dùng card/accordion/empty-state/loading/Field chung, có trạng thái rỗng & tải rõ ràng.

**Why này priority**: Hỗ trợ tin cậy & chuyển đổi nhưng không nhạy cảm bằng P1.

**Acceptance Scenarios**:

1. **Given** `/elections`, **When** đang tải / không có dữ liệu, **Then** hiện trạng thái tải/rỗng nhất quán; thẻ cuộc bầu cử dùng card chung.
2. **Given** `/faq`, **When** mở/đóng mục, **Then** accordion nhất quán, bàn phím thao tác được.
3. **Given** `/lien-he`, **When** gửi form, **Then** validate + lỗi/thành công hiển thị rõ; logic gửi (Redux) không đổi.

---

### User Story 4 - Trang pháp lý đồng bộ, không "scroll hell" thêm (Priority: P3)

Người đọc Chính sách bảo mật / Điều khoản sử dụng vẫn có mục lục dính + nút về đầu trang; màu/chữ đồng bộ token, không phá animation, không phình thêm chiều cao.

**Acceptance Scenarios**:

1. **Given** trang pháp lý dài, **When** cuộn, **Then** ToC dính + back-to-top hoạt động; token màu/chữ đồng bộ hệ chung; chiều cao không tăng so với trước.

---

### Edge Cases

- Không có cuộc bầu cử công khai / lỗi tải danh sách: trạng thái rỗng/lỗi có hướng dẫn.
- reCAPTCHA tắt qua cờ runtime: form vẫn submit đúng luồng (không chặn nhầm).
- MetaMask chưa cài / sai mạng / user huỷ ký: thông báo rõ bằng mẫu chung, không sập.
- OTP hết hạn / sai nhiều lần: hiển thị thông điệp backend (gồm lockout) rõ, không lộ OTP.
- Màn hình rất nhỏ/rất rộng: bố cục co giãn; bàn phím/đọc màn hình tới được mọi điều khiển.
- Form đang nhập dở khi chuyển tab/bước: dữ liệu không bị mất.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Vỏ công khai (Header, Footer, AppBeforeLogin) PHẢI nhất quán theo token clay; không màu hardcode/gradient tự chế; điều hướng có trạng thái rõ.
- **FR-002**: Điều hướng công khai PHẢI responsive: dưới ngưỡng mobile chuyển hamburger/drawer đóng/mở được (nút/nền/Esc), target ≥44px; focus-visible rõ; giữ skip-link.
- **FR-003**: Trang chủ (`/`) PHẢI trình bày giá trị sản phẩm bằng component/section chung, không lẫn kiểu tự chế.
- **FR-004**: Trang đăng nhập (`/login`) PHẢI dùng Field/Button chung, lỗi hiển thị rõ; **GIỮ NGUYÊN verbatim** `handleAutoLogin`/`handleCredentialsLogin`/`handleMetaMaskLogin` + recaptcha + nonce + `resetSecurityState`/`clearAllAccessCache` (không đổi luồng/điều kiện).
- **FR-005**: Trang đăng ký (`/register`) PHẢI tái cấu trúc *vỏ trang* bằng component chung; **GIỮ NGUYÊN** `handleSave`+recaptcha và **KHÔNG đụng** sub-component `NewAccountForm`.
- **FR-006**: Luồng khôi phục mật khẩu (tìm tài khoản → OTP → đặt lại) PHẢI trình bày theo bước rõ ràng bằng component chung; **GIỮ NGUYÊN** logic gửi/xác minh OTP; OTP không echo/không lưu plaintext nơi script chạm.
- **FR-007**: Trang `/elections`, `/faq`, `/lien-he`, `/thank-you` PHẢI dùng card/accordion/empty-state/loading/Field chung; trạng thái rỗng & tải rõ ràng; logic dữ liệu (Redux/react-hook-form) không đổi.
- **FR-008**: Trang pháp lý (`/chinh-sach-bao-mat`, `/dieu-khoan-su-dung`) PHẢI đồng bộ token màu/chữ, GIỮ mục lục dính + back-to-top + animation; KHÔNG tăng chiều cao cuộn.
- **FR-009**: Toàn bộ trang công khai PHẢI dùng **một** hệ thông báo (`notify`); 0 thư viện toast khác ở trang công khai.
- **FR-010**: Mọi điều khiển PHẢI truy cập bằng bàn phím, có nhãn/aria, vòng focus rõ; văn bản đạt tương phản ≥ AA.
- **FR-011**: Thay đổi PHẢI tối thiểu đúng scope ("lift JSX, keep logic"); tái dùng lớp clay sẵn có; KHÔNG thêm thư viện UI; KHÔNG sửa BE/contract; KHÔNG secret mới; KHÔNG tăng bề mặt legacy; KHÔNG đụng `frontend/src/test/**`, HomePage, hay 5 trang app.
- **FR-012**: Tuân thủ Hiến chương — Principle I (Security & Integrity First) là blocker tuyệt đối: handler auth/recaptcha/OTP giữ verbatim; không làm yếu xử lý bí mật.

### Key Surfaces (phạm vi giao diện)

- **Vỏ công khai**: `AppBeforeLogin`, `Header`, `Footer`.
- **Form & auth**: `LoginPage`, `DangKyTaiKhoanPage` (vỏ), `TimTaiKhoanPage`, `GuiOTPPage`, `DatLaiMatKhauPage`.
- **Marketing/nội dung**: `ChaoMungPage`, `CacCuocBauCuPage`, `FaqPage`, `LienHe`, `CamOnPage`.
- **Pháp lý (đồng bộ token)**: `ChinhSachBaoMatPage`, `DieuKhoanSuDungPage`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% trang công khai trong scope dùng component dùng chung (clay); 0 màu hardcode/gradient tự chế / `gray-*`/`blue-*`/`sky-*` ad-hoc còn lại ở các trang form & marketing (rà soát có chứng cứ `file:line`).
- **SC-002**: 0 thư viện toast khác `react-hot-toast` (qua `notify`) ở trang công khai.
- **SC-003**: 5 luồng nghiệp vụ công khai không hồi quy: đăng nhập (mật khẩu + MetaMask), đăng ký, khôi phục mật khẩu (OTP), gửi liên hệ, xem danh sách bầu cử công khai. Handler bảo mật giữ **verbatim** (đối chiếu diff).
- **SC-004**: Quality gate xanh: cổng tsc kiểu active-path (mở rộng `tsconfig.active.json` phủ trang công khai) = **0 lỗi** (không tăng so với baseline); 0 secret; 0 tăng legacy; `package.json` không thêm lib UI; BE 0 đụng.
- **SC-005**: Mọi điều khiển trang công khai thao tác được hoàn toàn bằng bàn phím; focus-visible rõ; target điều hướng mobile ≥44px; tương phản ≥ AA.
- **SC-006**: Trang pháp lý: chiều cao cuộn KHÔNG tăng so với trước (đo `scrollHeight` runtime); ToC dính + back-to-top vẫn hoạt động.

## Assumptions

- Kế thừa quyết định Đợt 10: Apple-like sáng + accent xanh, light-only (tôn trọng Đợt 7), không đổi thương hiệu, không dark mode mới.
- Tái dùng `src/components/ui/clay/*` + `notify` (Đợt 10); chỉ bổ sung component dùng chung nếu thật sự thiếu (vd Accordion clay) và biện minh trong `plan.md`.
- BE (ASP.NET Core net9.0) không kỳ vọng đụng; chỉ sửa nếu UX bị chặn (không dự kiến).
- `NewAccountForm` (features) ngoài scope — chỉ tái cấu trúc vỏ `DangKyTaiKhoanPage`.
- Cổng chất lượng: mở rộng `tsconfig.active.json` (Đợt 10.1) để phủ trang công khai; baseline lỗi pre-existing legacy ngoài import-graph không thuộc trách nhiệm đợt này.

## Out of Scope

- HomePage (`/app`) và 5 trang app (đã xong Đợt 10/10.1).
- `NewAccountForm` và logic Redux/BE của auth/đăng ký/contact/OTP (chỉ đổi trình bày vỏ).
- Thêm dark mode, đổi thương hiệu/hệ màu, thêm thư viện UI.
- Chuẩn hoá shape type legacy auth/OTP (cần spec security-review riêng — ghi ở REMEDIATION_DOT10).
- Dọn dead-code legacy ngoài việc không tăng bề mặt.
