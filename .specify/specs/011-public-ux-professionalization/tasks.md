---
description: "Task list — Đợt 11 Public UX Professionalization"
---

# Tasks: Đợt 11 — Chuyên nghiệp hoá UX/UI trang công khai

**Input**: `.specify/specs/011-public-ux-professionalization/` (plan/spec/research/data-model/contracts/quickstart)
**Tests**: KHÔNG sinh test-suite. Verify = `npm run typecheck:active` + `git diff`/grep + luồng `quickstart.md`.
**Scope guard (mọi task)**: frontend-only; KHÔNG đụng BE/Redux/contract/`NewAccountForm`/`src/test/**`/5 trang app/HomePage; KHÔNG thêm lib UI; KHÔNG secret; light-only; tái dùng clay.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Baseline: `cd frontend && npm run typecheck:active` ghi số lỗi hiện tại vào `.specify/specs/011-public-ux-professionalization/baseline-metrics.md`; mở `/chinh-sach-bao-mat` & `/dieu-khoan-su-dung` 1440×900 ghi `document.documentElement.scrollHeight` (proxy tĩnh nếu không chạy được browser: số dòng file). **Verify**: file có số liệu.
- [X] T002 [P] Xác nhận branch `011-public-ux-professionalization`, tree sạch. **Verify**: đúng branch.

---

## Phase 2: Foundational (Blocking)

- [X] T003 Mở rộng `frontend/tsconfig.active.json` `include`: thêm `src/AppBeforeLogin.tsx`, `src/components/Header.tsx`, `src/components/Footer.tsx`, và 11 trang công khai (ChaoMung/Login/DangKyTaiKhoan/CacCuocBauCu/Faq/LienHe/CamOn/ChinhSachBaoMat/DieuKhoanSuDung/TimTaiKhoan/GuiOTP/DatLaiMatKhau). **Verify**: `npm run typecheck:active` chạy (ghi baseline lỗi của các trang này — pre-existing không thuộc Đợt 11 nếu có).
- [X] T004 [P] Tạo `frontend/src/components/ui/clay/Accordion.tsx` trên `@radix-ui/react-accordion` theo `contracts/component-reuse.md`; export qua barrel `index.ts`. **Verify**: `npm run typecheck:active` sạch phần clay.

**Checkpoint**: cổng tsc phủ trang công khai + Accordion sẵn sàng.

---

## Phase 3: User Story 1 — Vỏ công khai & landing (P1) 🎯 MVP

**Goal**: AppBeforeLogin/Header/Footer + ChaoMungPage nhất quán clay, a11y.
**Independent Test**: duyệt trang công khai → header/footer đồng nhất; mobile drawer Esc/≥44px; landing chuyên nghiệp.

- [X] T005 [US1] `frontend/src/components/Header.tsx`: dùng token clay, drawer/hamburger a11y (Esc/focus-trap/role=dialog/≥44px); GIỮ logic search/UserMenu/auth-state. **Verify**: `git diff` không đụng logic; bàn phím OK; `typecheck:active` sạch.
- [X] T006 [P] [US1] `frontend/src/components/Footer.tsx`: đồng bộ token clay; GIỮ newsletter Redux logic. **Verify**: `git diff` chỉ class/JSX; `typecheck:active` sạch.
- [X] T007 [P] [US1] `frontend/src/AppBeforeLogin.tsx`: vỏ clay nhất quán (giữ skip-link, Toaster, ThemeProvider). **Verify**: `typecheck:active` sạch.
- [X] T008 [US1] `frontend/src/pages/ChaoMungPage.tsx`: chuẩn hoá section/CTA bằng clay (Button/Panel/SectionCard), bỏ class tự chế/màu hardcode. **Verify**: grep 0 `gray-/sky-/#0288D1/bg-gradient` ad-hoc; `typecheck:active` sạch.
- [X] T009 [US1] Checkpoint US1: quickstart §A + duyệt vỏ/landing không hồi quy. **Verify**: `npm run typecheck:active`=0 cho phần US1; commit lát US1.

**Checkpoint**: US1 độc lập (MVP vỏ công khai).

---

## Phase 4: User Story 2 — Form auth & khôi phục mật khẩu (P1) 🔒

**Goal**: Login/Register(vỏ)/OTP-recovery dùng clay, **handler bảo mật verbatim**.
**Independent Test**: 5 luồng auth/OTP không hồi quy; POST-diff sạch handler.

- [X] T010 [US2] PRE-GATE: trích **verbatim** vào `.specify/specs/011-public-ux-professionalization/auth-otp-reference.md` các handler: LoginPage `getRecaptchaToken/handleAutoLogin/handleCredentialsLogin/handleMetaMaskLogin`; DangKyTaiKhoanPage `handleSave`; TimTaiKhoan/GuiOTP/DatLaiMatKhau hàm gửi/xác minh OTP & đặt lại + số dòng gốc. **Verify**: file đủ các đoạn.
- [X] T011 [US2] `frontend/src/pages/LoginPage.tsx`: thay JSX 2 cột bằng clay (Panel/Field/Button/StatusBadge/Stepper cho MetaMask steps); GIỮ NGUYÊN 4 handler + state + tab credentials/MetaMask + recaptcha + nonce. **Verify**: `git diff` chỉ import/JSX; `typecheck:active` sạch.
- [X] T012 [US2] `frontend/src/pages/DangKyTaiKhoanPage.tsx`: tái cấu trúc vỏ + benefits bằng clay; `<NewAccountForm onSave={handleSave}/>` render y nguyên (KHÔNG đổi props/component); GIỮ `handleSave`+recaptcha+success dialog state. **Verify**: `git diff` không đụng NewAccountForm/handleSave; `typecheck:active` sạch.
- [X] T013 [P] [US2] `frontend/src/pages/TimTaiKhoanPage.tsx` + `GuiOTPPage.tsx` + `DatLaiMatKhauPage.tsx`: clay Field/Button/Stepper, lỗi inline; GIỮ verbatim hàm OTP/đặt lại; OTP không echo/không plaintext. **Verify**: grep không echo OTP; `git diff` không đụng hàm OTP; `typecheck:active` sạch.
- [X] T014 [US2] POST-GATE: `git diff HEAD -- LoginPage.tsx DangKyTaiKhoanPage.tsx TimTaiKhoanPage.tsx GuiOTPPage.tsx DatLaiMatKhauPage.tsx` — **0 dòng** handler/`executeRecaptcha`/`personal_sign`/`registerAccount`/`login(`/`loginWithMetaMask`/`refreshJwtToken`/`resetSecurityState`/`clearAllAccessCache`/OTP-verify xuất hiện (đối chiếu `auth-otp-reference.md`). **Verify**: diff sạch các vùng đó.
- [X] T015 [US2] Checkpoint US2: quickstart §A + §B1–B4. **Verify**: `typecheck:active`=0; commit lát US2.

**Checkpoint**: US1+US2 độc lập; bất biến auth/OTP giữ nguyên.

---

## Phase 5: User Story 3 — Marketing/nội dung (P2)

- [X] T016 [P] [US3] `frontend/src/pages/CacCuocBauCuPage.tsx`: clay Panel/EmptyState/Loader cho lưới + trạng thái rỗng/tải; GIỮ Redux fetch. **Verify**: `typecheck:active` sạch; §B6.
- [X] T017 [P] [US3] `frontend/src/pages/FaqPage.tsx`: dùng clay `Accordion`; GIỮ data. **Verify**: bàn phím accordion; `typecheck:active` sạch.
- [X] T018 [P] [US3] `frontend/src/pages/LienHe.tsx`: clay Field/Button/StatusBadge; GIỮ react-hook-form + `lienHeSlice` dispatch. **Verify**: `git diff` không đụng submit logic; §B5; `typecheck:active` sạch.
- [X] T019 [P] [US3] `frontend/src/pages/CamOnPage.tsx`: clay Panel/Button. **Verify**: `typecheck:active` sạch.
- [X] T020 [US3] Checkpoint US3: quickstart §A + §B5/§B6 + SC-001/002 grep. **Verify**: đạt; commit lát US3.

---

## Phase 6: User Story 4 — Đồng bộ token trang pháp lý (P3)

- [ ] T021 [P] [US4] `frontend/src/pages/ChinhSachBaoMatPage.tsx`: thay class màu/chữ hardcode → token clay; KHÔNG đụng framer-motion scroll/ToC/back-to-top. **Verify**: `scrollHeight` 1440×900 KHÔNG tăng vs T001; `typecheck:active` sạch.
- [ ] T022 [P] [US4] `frontend/src/pages/DieuKhoanSuDungPage.tsx`: như trên. **Verify**: `scrollHeight` không tăng; ToC/back-to-top OK; `typecheck:active` sạch.
- [ ] T023 [US4] Checkpoint US4: quickstart §A + §C SC-006. **Verify**: đạt; commit lát US4.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T024 [P] grep trang công khai: 0 `gray-/blue-/sky-` ad-hoc & màu hardcode (#0288D1…)/gradient tự chế còn ở form & marketing (SC-001). **Verify**: grep rỗng / có chứng cứ `file:line`.
- [ ] T025 [P] grep: 0 `sweetalert2|sonner|react-toastify` ở trang công khai (SC-002); `git diff package.json` không thêm lib UI. **Verify**: rỗng.
- [ ] T026 a11y sweep trang công khai: keyboard/focus-visible/≥44px/AA (SC-005). **Verify**: checklist đạt.
- [ ] T027 Full `npm run typecheck:active`=0 + chạy quickstart §B (6 luồng) + ghi SC vào `baseline-metrics.md`. **Verify**: gate xanh.
- [ ] T028 [P] Cập nhật `docs/audit/REMEDIATION_DOT11.md` (tóm tắt phạm vi/kết quả/cổng auth-OTP/scrollHeight) + CLAUDE.md SPECKIT pointer; dọn scratch nếu có. **Verify**: file + link hợp lệ.

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (chặn mọi US).
- US1 (P3) & US2 (P4) sau Foundational; US2 cần PRE→POST cứng (T010 trước T011–T013, T014 sau).
- US3 (P5), US4 (P6) sau Foundational (hưởng clay).
- Polish (P7) sau khi US mong muốn xong.
- "Lift JSX, keep logic": KHÔNG đổi handler/Redux/NewAccountForm.

## Parallel Opportunities
- Setup: T002 ∥ T001. Foundational: T004 ∥ (sau T003).
- US1: T006,T007 ∥ (T005,T008 tuần tự theo file). US2: T013 ∥ (T011,T012). US3: T016–T019 ∥. US4: T021 ∥ T022. Polish: T024,T025,T028 ∥.

## Implementation Strategy
MVP = Setup→Foundational→US1→US2 (kèm cổng auth/OTP) → STOP & VALIDATE. Incremental: US3 → US4 → Polish, mỗi lát chạy §A + §B liên quan + commit.

## Notes
- **Bất biến tuyệt đối**: handler auth/recaptcha/OTP verbatim (research §INV) — T010/T014 là cổng cứng US2.
- Mỗi lát commit độc lập; dừng checkpoint để validate.
