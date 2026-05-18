---
description: "Tasks — Đợt 2 Remediation Bảo Mật Cao"
---

# Tasks: Đợt 2 — S6,S7,S8,S9,S10,S13

**Input**: `./spec.md`, `./plan.md`, `../../../docs/audit/AUDIT_2026-05-18.md`
Mỗi task có Verify cụ thể (Constitution IV). Branch `002-security-remediation-high` (stack trên 001).

## Phase 1: Backend Program.cs (S10, S6)

- [ ] T001 [US5] S10: `Program.cs` — `Cors:AllowedOrigins` đọc từ config/env (array), bỏ origin azurewebsites/hardcode; giữ AllowCredentials theo danh sách cấu hình. Verify: build 0 error; scan source 0 `azurewebsites` origin hardcode.
- [ ] T002 [US1] S6: `Program.cs` — `AddRateLimiter` + policy `voter-invites` (fixed window per IP), gắn vào nhóm route `voter-invites/*`. Verify: build 0 error; gọi dồn → 429, bình thường → 200.

## Phase 2: Backend RosterService (S7, S13)

- [ ] T003 [US2] S7: `ElectionV1RosterService.StudentCodeMatches` — roster có mã ⇒ bắt buộc khớp; không coi blank là match. Verify: build 0 error; request thiếu mã khi roster có mã → từ chối.
- [ ] T004 [US6] S13: gắn `ClaimedByUserId` khi OTP-verify (account xác thực); `PrepareWalletBinding`/`BindWallet` từ chối nếu caller ≠ account đã verify. Verify: build 0 error; account khác có token → bind bị từ chối.

## Phase 3: Frontend XSS (S8)

- [ ] T005 [US3] S8: thêm `dompurify`+`@types/dompurify`; bọc `dangerouslySetInnerHTML` ở trang **active** (vd `XemChiTietCuocBauCuPage` nếu active; `TaoTaiKhoanForm`) bằng `DOMPurify.sanitize`. Usage ở page legacy/unrouted để Đợt 3 xoá. Verify: scoped tsc file đụng 0 lỗi do thay đổi; payload `<script>` bị loại.

## Phase 4: Smart contract turnout (S9) — ripple lớn

- [ ] T006 [US4] `ElectionV1.sol`: thêm immutable `minReveals`,`enforceQuorum`; `finalizeElection` revert nếu `enforceQuorum && totalRevealed<minReveals`, ngược lại set `lowTurnout` + emit `LowTurnout`. Constructor + getter cập nhật.
- [ ] T007 [US4] `ElectionFactoryV1.sol`: truyền 2 tham số mới qua create; default an toàn.
- [ ] T008 [US4] Scripts `blockchain_sm/scripts/*` (build/create/deploy) + manifest: thêm 2 tham số, default `minReveals=0,enforceQuorum=false`.
- [ ] T009 [US4] ABI đồng bộ: backend `ElectionV1ReadService` inline ABI + FE inline `electionV1Abi` (QuanLySmartContractPage) thêm field/constructor mới nếu đọc tới. Verify: backend build 0 error; FE scoped tsc 0 lỗi do thay đổi.
- [ ] T010 [US4] Test Hardhat: 2 ca — enforceQuorum=true revert khi thiếu; =false set lowTurnout. Verify: `npm test` pass cả mới lẫn cũ.

## Phase 5: Gate

- [ ] T011 Cập nhật `AUDIT_2026-05-18.md` (S6,S7,S8,S9,S10,S13=Resolved) + `REMEDIATION_DOT2.md`. Verify trạng thái khớp.
- [ ] T012 Full quality gate (contracts compile+test, dotnet build 0 error, scoped tsc, scan). Commit + push fork + PR đợt 2.

## Execution order

S10→S6 (cùng Program.cs) → S7→S13 (cùng RosterService) → S8 (FE) → S9 (contract, cuối, test kỹ) → gate.
