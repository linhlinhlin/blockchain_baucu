# Feature Specification: Đợt 3 — Dọn Legacy

**Feature Branch**: `003-legacy-cleanup` (stack trên 002)
**Created**: 2026-05-19
**Status**: Done (safe subset) · follow-up ghi nhận
**Input**: `docs/audit/AUDIT_2026-05-18.md` (S11 + frontend/infra audit), `REMEDIATION_BACKLOG.md`
**Decision log**: `docs/audit/REMEDIATION_DOT3.md`

## Problem

Bề mặt legacy lớn: `src/test/**`/`testWeb3` (UI paymaster/session-key, tàn dư key), AA-stack ABI, `geth.holihu.online` hardcode, `SimpleElectionFlow.sol` deployable không eligibility (S11), Ignition wire AA stack, ~11 dependency chết. Tăng bundle + bề mặt tấn công, cần `--legacy-peer-deps`.

## Goal

Giảm bề mặt legacy & bảo mật mà KHÔNG phá app đang chạy: xóa cụm dead 0-blocker giá trị cao, gỡ dep unused, đưa flow/Ignition AA ra `legacy/`. Đo: contracts 9/9, active jest pass, 0 file reachable import module đã xóa.

## User Stories

### US1 — Sạch tàn dư legacy nhạy cảm (P1)
Xóa `src/testWeb3`, phần lớn `src/test`, `ContractABIs.tsx`, `utils/blockchain.ts`, `bundler-sdk.tsx`, `ThamGiaBauCuPage`, `QuanLyPhienBauCuPage`, `components/bophieu`. **Test**: grep import chính xác → 0 file reachable dùng; active jest pass.

### US2 — Gỡ dependency chết (P2)
Gỡ 11 dep 0-import. **Test**: `npm install` thành công, app reachable không gãy.

### US3 — Cô lập legacy contract (P2, S11)
`SimpleElectionFlow.sol`, flow test/scripts, `HoLiHuDeployment.ts` → `legacy/`. **Test**: `npm run compile` OK, `npm test` 9/9.

## Requirements

- **FR-001**: Chỉ xóa file KHÔNG nằm trong import-closure active (verify bằng grep import chính xác). KHÔNG phá build runtime (vite tree-shake).
- **FR-002 (S11)**: `SimpleElectionFlow.sol` ra khỏi Hardhat `sources` (build path).
- **FR-003**: Gỡ dep chỉ khi 0 import toàn `src` (giữ dep còn dùng ở code reachable / test-infra active).
- **FR-004**: Không gate backend legacy nếu làm vỡ controller web2 active (ghi nhận lý do — deferred).

## Success Criteria

- **SC-001**: contracts `npm test` 9/9; `npm run compile` OK.
- **SC-002**: active jest suite pass (reachable code nguyên vẹn).
- **SC-003**: 0 file reachable import module đã xóa.
- **SC-004**: S11 đóng (SimpleElectionFlow không còn deployable từ build path).

## Out of Scope (follow-up, ghi nhận trong REMEDIATION_DOT3)

- Deep purge ~150 file dead misc + route-surgery nhánh redirect legacy (rủi ro cao, cần kiểm thử UI).
- Backend legacy DI gating (cần decouple controller web2 active — effort "thin backend").
- Pin Node LTS để chạy full `tsc`/`vite build` xác nhận bundle (Đợt 4 / S19).
