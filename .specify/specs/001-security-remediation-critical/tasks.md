---
description: "Task list — Đợt 1 Remediation Bảo Mật Khẩn (Critical)"
---

# Tasks: Đợt 1 — Remediation Bảo Mật Khẩn (Critical)

**Input**: `./spec.md`, `./plan.md`, `../../../docs/audit/AUDIT_2026-05-18.md`
**Tests**: smoke/scan verify per task (đây là remediation, không TDD đầy đủ).
**Organization**: nhóm theo user story, mỗi story độc lập deliver được.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác file, không phụ thuộc)
- **[Story]**: US1–US4 ánh xạ tới spec
- Path tuyệt đối/đầy đủ trong mô tả

## Path Conventions

- Backend: `WebApplication3/WebApplication3/WebApplication3/`
- Frontend: `frontend/src/`
- Contracts: `blockchain_sm/`

---

## Phase 1: Setup (Shared)

- [ ] T001 Tạo branch `001-security-remediation-critical` từ `main`; xác nhận quality-gate baseline xanh (`blockchain_sm`: `npm run compile && npm test`; backend: `dotnet build WebApplication3/WebApplication3/WebApplication3.sln -c Debug`). Verify: contracts 12/12 pass, backend 0 error.
- [ ] T002 [P] Chuẩn bị script scan secret tái dùng: regex private-key 64-hex + JWT literal, chạy chỉ trên file committed (loại `node_modules`, `.specify`). Verify: script chạy ra baseline finding hiện tại (≥5 file S1).

---

## Phase 2: Foundational (Blocking)

**⚠️ Không story nào merge được trước khi mục này xong.**

- [ ] T003 Xác nhận `.gitignore` đã chặn `.env`, `appsettings.*.json` bí mật; thêm `appsettings.Development.json.example` (mô tả mọi key bắt buộc: `JwtSettings:Secret`, `ConnectionStrings:*`, `ElectionV1StoreSettings:Provider`, `DevelopmentAuthSettings:Enabled`). Verify: fresh clone đọc example dựng được dev. (Constitution V)

**Checkpoint**: nền tảng sẵn — US1–US4 chạy song song được.

---

## Phase 3: User Story 1 — Không còn secret trong repo (P1) 🎯 MVP

**Goal**: 0 private-key trong file committed; key đã lộ được rotate/ghi nhận.
**Independent Test**: scan repo committed → 0 match; build active path xanh.

- [ ] T004 [US1] Liệt kê toàn bộ file legacy chứa key: `frontend/src/test/utils/createElection.js:34`, `frontend/src/components/election-session-manager/complete-election-workflow.js:36`, `frontend/src/test/ThuPhienBauCu.tsx:15`, `frontend/src/test/ThemCuTriPage.tsx:315`, `frontend/src/test/components/admin-dashboard.tsx:47-68` (+ quét bổ sung `src/test/**`, `src/testWeb3/**`). Verify: danh sách đầy đủ khớp scan T002.
- [ ] T005 [US1] Xóa các file/legacy test pages chứa key (không nằm trên active route — đối chiếu `frontend/src/routes/AppRoutes.tsx`). Verify: `cd frontend && npm run typecheck` active path không lỗi mới; nếu vỡ do import legacy → exclude trong `tsconfig.json` thay vì giữ key.
- [ ] T006 [US1] Viết `docs/audit/REMEDIATION_S1.md`: bảng key đã lộ → hành động (rotated / xác nhận không funded trên Sepolia), ngày, người thực hiện. Verify: mọi key ở T004 có dòng trạng thái.
- [ ] T007 [US1] Chạy lại scan T002 toàn repo committed. Verify: **0** private-key 64-hex match.

**Checkpoint**: US1 hoàn tất, test độc lập được.

---

## Phase 4: User Story 3 — JWT không forge được (P1)

**Goal**: không còn secret JWT tĩnh; thiếu secret ⇒ fail-fast.
**Independent Test**: khởi động không có `JwtSettings:Secret` → app từ chối; scan source/compose 0 literal.

- [ ] T008 [US3] Sửa `WebApplication3/WebApplication3/WebApplication3/Program.cs:45-48`: bỏ hằng số `"holihu-local-dev-jwt-secret-2026-change-me"`; nếu `JwtSettings:Secret` rỗng → `throw`/fail-fast với thông báo rõ. Verify: chạy không cấu hình secret → app dừng với message; có secret → chạy bình thường.
- [ ] T009 [US3] Bỏ JWT secret literal khỏi `docker-compose.active.yml:45`; chuyển sang biến từ `.env`/compose env, cập nhật `appsettings.Development.json.example`. Verify: scan T002 → 0 JWT literal trong file committed; `docker compose -f docker-compose.active.yml config` vẫn hợp lệ.
- [ ] T010 [US3] `dotnet build` lại + smoke login dev. Verify: 0 error; login devadmin hoạt động khi secret được cấu hình.

**Checkpoint**: US3 hoàn tất.

---

## Phase 5: User Story 2 — OTP an toàn (P1)

**Goal**: OTP hash, không echo, có rate-limit.
**Independent Test**: API non-dev không trả mã; verify-otp bị lockout sau N lần.

- [ ] T011 [US2] Đổi model OTP sang `OtpRecord` (otpHash+salt, expiresAt, attemptCount, lockedUntil, consumed) thay `LastOtpCode` plaintext trong `Services/ElectionV1RosterService.cs:208,269,1163`. Verify: build 0 error; OTP cũ bị coi là vô hiệu.
- [ ] T012 [US2] Hash OTP bằng `BCrypt.Net-Next` (đã có sẵn) khi tạo; verify bằng so hash tại `:251-285`. Verify: DB/store chỉ chứa hash, không plaintext.
- [ ] T013 [US2] Bỏ field `DevOtpCode` khỏi response DTO `:1062` & dispatch `:234`; chỉ trả khi `DevelopmentAuthSettings:Enabled` tường minh (không dựa `IsDevelopment`). Verify: gọi `send-otp` ở chế độ non-dev → response không chứa mã.
- [ ] T014 [US2] Thêm đếm số lần thử + lockout/backoff per invite ở `verify-otp` (`ElectionV1Controller.cs:312-327`, service `:251-285`); cân nhắc ASP.NET rate limiting cho route `voter-invites/*`. Verify: thử sai > N lần → invite lockout, verify thất bại có thông báo.

**Checkpoint**: US2 hoàn tất.

---

## Phase 6: User Story 4 — Vote-secret không bị đánh cắp/forge (P1)

**Goal**: reveal có owner-check; salt không plaintext localStorage.
**Independent Test**: vote package ví khác → reveal bị chặn; không tìm thấy salt plaintext dùng được.

- [ ] T015 [US4] `frontend/src/pages/QuanLySmartContractPage.tsx:161-178,587`: trước `revealVote`, kiểm `storedVotePackage.voter === địa chỉ ví đang kết nối`; khác → từ chối + cảnh báo, không gọi `revealVote`. Verify: kết nối ví khác → nút Reveal báo lỗi, không phát tx. (S5 — làm trước, rẻ)
- [ ] T016 [US4] `:177-179` (`saveStoredVotePackage`): đổi key lưu gắn `voter`; chuyển salt sang session-scoped/memory hoặc mã hoá passphrase (đánh giá UX, không bắt buộc mã hoá nếu UX không chấp nhận — tối thiểu không để plaintext localStorage bền vững). Thêm cảnh báo UI "reveal cần cùng thiết bị/ví". Verify: sau commit, DevTools → localStorage không còn salt plaintext khả dụng; luồng commit→reveal cùng ví/thiết bị vẫn chạy. (S4)
- [ ] T017 [US4] `npm run typecheck` + kiểm thủ công luồng commit→reveal→finalize cùng ví OK. Verify: typecheck active path sạch; happy path không vỡ.

**Checkpoint**: US4 hoàn tất.

---

## Phase 7: Polish & Gate

- [ ] T018 Cập nhật `docs/audit/AUDIT_2026-05-18.md` đánh dấu S1–S5 = Resolved (link commit). Verify: trạng thái khớp thực tế.
- [ ] T019 Re-audit nhanh phần S1–S5 (có thể giao agent đọc lại). Verify: **SC-001** 0/5 Critical còn mở.
- [ ] T020 Chạy full quality gate. Verify: contracts compile+test pass; backend `dotnet build` 0 error; frontend `tsc --noEmit` active path sạch; scan 0 secret (SC-002..SC-005).

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → (US1, US3, US2, US4 song song nếu đủ người) → Phase 7.
- Khuyến nghị tuần tự ưu tiên: **US1 → US3 → US2 → US4** (giảm rủi ro lộ key trước).
- US độc lập, không cross-dependency bắt buộc; tránh sửa trùng file `QuanLySmartContractPage.tsx` (US4: T015/T016 cùng file → tuần tự, không [P]).

## Parallel Opportunities

- T002 [P] với T001; T004 (liệt kê) độc lập T008/T011/T015 (khác module).
- US1 (frontend xóa) ∥ US3 (backend Program.cs) ∥ US2 (backend RosterService) — khác file, song song được; US4 sau cùng vì cùng đụng frontend page với US1.

## Notes

- Mỗi task có Verify cụ thể — không "done" mơ hồ (Constitution IV).
- Commit sau mỗi task/nhóm; PR link `spec.md` + `plan.md`.
- KHÔNG mở rộng scope sang S6–S20 (Out of Scope spec này).
- Đợt này chỉ scaffold + chốt scope; `/speckit-implement` chạy sau khi team duyệt.
