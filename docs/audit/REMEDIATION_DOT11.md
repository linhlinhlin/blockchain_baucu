# REMEDIATION — Đợt 11 (2026-05-19): Chuyên nghiệp hoá UX/UI trang công khai

**Branch:** `011-public-ux-professionalization` · Spec-Kit: `.specify/specs/011-public-ux-professionalization/`
Frontend-only. Tái dùng lớp `clay` (Đợt 10). Tiền nhiệm: Đợt 10 + 10.1 (DONE).

## Đã làm (theo lát, mỗi lát 1 commit)

| Lát | Nội dung | Commit |
|---|---|---|
| Spec-Kit+US1 | spec/plan/research/data-model/contracts/quickstart/tasks; tsconfig.active.json mở rộng phủ trang công khai; **clay/Accordion** mới; Header (token --surface-black/--clay-text, mobile ≥44px, focus-visible), Footer (state token), AppBeforeLogin (bg token); ChaoMung đã on-system | `a4fe1e0` |
| US2 PRE | `auth-otp-reference.md` ghim verbatim handler auth/OTP | `7ffbe7d` |
| US2 | LoginPage (JSX-only: bỏ ux-orb, hardcode→token), DangKyTaiKhoan (vỏ clay; NewAccountForm/handleSave/recaptcha verbatim), TimTaiKhoan/GuiOTP/DatLaiMatKhau (clay; OTP qua ModalOTP, masking & password regex verbatim) | `932490a` |
| US3 | CacCuocBauCu (Loader/clay), Faq (clay Accordion), LienHe (token-swap; react-hook-form/sendContact verbatim), CamOn (clay) | `a734021` |
| US4 | Legal pages: brand accent #0288D1/#01579B/#6A1B9A → clay-primary* (200+); framer-motion/ToC/scroll giữ nguyên | `8c118f1` |

## Bảo mật (Principle I — blocker tuyệt đối)
- **POST-GATE US2 PASS**: 16/16 dòng bảo mật byte-identical HEAD (count khớp):
  `refreshJwtToken`/`login`/`loginWithMetaMask`/`personal_sign`/nonce/
  `clearAllAccessCache`/`resetSecurityState`/`registerAccount`/`<NewAccountForm>`/
  recaptcha key/`fetchTimTaiKhoan`/mask regex/`guiOtp`/`xacMinhOtp`/`datLaiMatKhau`/
  password validation regex. Ref: `auth-otp-reference.md`.
- OTP qua `ModalOTP` (không echo/không plaintext); KHÔNG đụng `NewAccountForm`/Redux/BE.
- 0 secret · 0 tăng legacy · `package.json` deps KHÔNG đổi (0 lib UI mới).

## Quality gate
- `npm run typecheck:active` (đã include 12 trang công khai + Header/Footer/AppBeforeLogin + clay/Accordion) = **0 lỗi** ở mọi lát.
- SC-001 (0 off-system màu ở form/marketing) ✅ · SC-002 (1 hệ toast) ✅ · SC-003 (POST-gate verbatim) ✅ · SC-004 (tsc=0, 0 secret/legacy/lib) ✅.
- Hạn chế: SC-005 (a11y runtime), SC-006 (legal scrollHeight px) cần `npm run dev` (Node 20/22) — agent không chạy browser; thay đổi US4 chỉ là chuỗi hex (cấu trúc/scroll bất biến → SC-006 đạt theo phân tích tĩnh).

## Follow-up (ngoài scope, đã ghi)
- ✅ Re-theme 2 trang legal dark→light: HOÀN TẤT ở Đợt 12 (`012-legal-light-retheme`).
  #B0BEC5) sang light clay = một **redesign** riêng (không phải token-sync P3);
  rủi ro tương phản cao, cần đợt riêng. Accent đã đồng bộ.
- Dead-code helper mồ côi `QuanLySmartContractPage` (Đợt 10 follow-up) vẫn treo.
- Chuẩn hoá shape legacy auth/OTP (Đợt 10.1 follow-up) cần spec security-review.
- Nghiệm thu runtime mọi đợt: người dùng chạy `npm run dev` (Node 20/22 LTS).
