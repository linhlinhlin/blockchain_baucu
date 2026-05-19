# Implementation Plan: Đợt 11 — Chuyên nghiệp hoá UX/UI trang công khai

**Branch**: `011-public-ux-professionalization` | **Date**: 2026-05-19 | **Spec**: [spec.md](./spec.md)
**Input**: `.specify/specs/011-public-ux-professionalization/spec.md`

## Summary

Áp dụng lớp `clay` (đã build & verify ở Đợt 10/10.1) cho toàn bộ trang công khai/pre-login để nhất quán & chuyên nghiệp, **giữ verbatim** mọi handler auth/recaptcha/OTP (mô hình cổng S4/S5). Cách tiếp cận đã chứng minh ở Đợt 10: "lift JSX, keep logic" qua targeted edits / Write giữ nguyên block logic; tái dùng component, 0 thư viện mới, 0 BE. Cổng chất lượng: mở rộng `frontend/tsconfig.active.json` phủ trang công khai → `npm run typecheck:active` = 0.

Phân lát độc lập: **US1** vỏ (Header/Footer/AppBeforeLogin) + landing → **US2** form auth + khôi phục mật khẩu (cổng verbatim) → **US3** marketing/nội dung (elections/faq/contact/thank-you) → **US4** đồng bộ token 2 trang pháp lý.

## Technical Context

**Language/Version**: TypeScript ~5.8, React 18.3 (frontend). BE `net9.0` — **không đụng**.
**Primary Dependencies**: Vite 6, Tailwind 3.4, Radix (đã cài), `react-hot-toast` (qua `notify`), `framer-motion` (animation legal pages — giữ), `react-hook-form` (LienHe — giữ), `react-google-recaptcha-v3` (giữ verbatim). **Lớp `src/components/ui/clay/*` (Đợt 10) tái dùng. Không thêm lib.**
**Storage**: N/A (Redux slices/BE không đổi).
**Testing**: `npm run typecheck:active` (mở rộng include trang công khai) = gate; kiểm thử thao tác theo `quickstart.md`.
**Target Platform**: Trình duyệt hiện đại; responsive ~360px.
**Project Type**: Web SPA — chỉ `frontend/`.
**Performance Goals**: Không hồi quy tải; trang pháp lý không tăng `scrollHeight`.
**Constraints**: Light-only (Đợt 7); single-accent + state tokens (Đợt 10); thay đổi tối thiểu; verbatim auth/recaptcha/OTP; không secret/legacy-growth/lib mới; không đụng `src/test/**`, `NewAccountForm`, Redux/BE, 5 trang app, HomePage.
**Scale/Scope**: Vỏ (3) + ~9 trang công khai + 2 trang pháp lý (đồng bộ token) + luồng OTP khôi phục mật khẩu (3 trang).

## Constitution Check

| Principle | Đánh giá | KL |
|---|---|---|
| **I. Security & Integrity First (NON-NEGOTIABLE)** | Chỉ đổi trình bày/vỏ. Pin verbatim (research §INV): LoginPage `handleAutoLogin/handleCredentialsLogin/handleMetaMaskLogin` + recaptcha + nonce `personal_sign` + `resetSecurityState/clearAllAccessCache`; DangKyTaiKhoanPage `handleSave`+recaptcha (KHÔNG đụng `NewAccountForm`); luồng OTP khôi phục mật khẩu (gửi/xác minh, không echo/không plaintext). Cổng PRE/POST diff như S4/S5. | **PASS** (guardrail tường minh) |
| **II. Auditability** | spec→plan→tasks→commit, `file:line`; hành vi auth không đổi luồng. | **PASS** |
| **III. Simplicity / Legacy Freeze** | Tái dùng clay (không mở rộng); chỉ thêm `Accordion` clay nếu thiếu (biện minh). Không đụng legacy/`src/test`/Redux/BE. | **PASS** (1 mục Complexity) |
| **IV. Spec-Driven & Surgical** | ≥3 surface + đụng trang bảo mật → Spec-Kit (đang chạy). Tối thiểu, verify cụ thể mỗi task. | **PASS** |
| **V. Reproducibility** | Không đổi toolchain; cổng `typecheck:active` committed (Đợt 10.1) mở rộng — tái lập được. | **PASS** |

→ **Cổng Hiến chương: PASS.**

## Project Structure

```text
.specify/specs/011-public-ux-professionalization/
├── plan.md  spec.md  research.md  data-model.md  quickstart.md
├── contracts/component-reuse.md   checklists/requirements.md
├── auth-otp-reference.md   # Phase-0 PRE pin (verbatim handler bảo mật)
└── tasks.md  (/speckit-tasks)
```

```text
frontend/src/
├── AppBeforeLogin.tsx          # [SỬA] vỏ clay nhất quán
├── components/Header.tsx       # [SỬA] clay + a11y drawer/hamburger ≥44px
├── components/Footer.tsx       # [SỬA] đồng bộ token clay
├── components/ui/clay/         # [TÁI DÙNG] (+ Accordion.tsx nếu thiếu — US3)
├── pages/
│   ├── ChaoMungPage.tsx                # US1 landing
│   ├── LoginPage.tsx                   # US2 (verbatim handlers)
│   ├── DangKyTaiKhoanPage.tsx          # US2 (vỏ; NewAccountForm KHÔNG đụng)
│   ├── TimTaiKhoanPage / GuiOTPPage / DatLaiMatKhauPage  # US2 OTP
│   ├── ChaoMung… CacCuocBauCuPage / FaqPage / LienHe / CamOnPage  # US3
│   └── ChinhSachBaoMatPage / DieuKhoanSuDungPage  # US4 token-sync
└── tsconfig.active.json        # [SỬA] include thêm trang công khai
```

**Structure Decision**: Chỉ `frontend/src`. Tái dùng `components/ui/clay/` (không namespace mới). Cổng tsc = mở rộng `tsconfig.active.json`. Không đổi router/Redux/BE.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Thêm `components/ui/clay/Accordion.tsx` (nếu FAQ cần) | FaqPage là accordion; 16 component Đợt 10 chưa có Accordion clay. Cần 1 primitive a11y nhất quán (Radix accordion đã cài sẵn). | Tự chế accordion trong FaqPage = lặp layout tự chế (đúng thứ Đợt 10 diệt). Một component clay dùng chung là hợp nhất, không mở rộng bừa. |

*Mọi mục khác: tái dùng, không lib, không BE/legacy/contract.*
