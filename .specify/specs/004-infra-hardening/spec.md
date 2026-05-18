# Feature Specification: Đợt 4 — Hạ tầng Hardening

**Feature Branch**: `004-infra-hardening` (stack trên 003)
**Created**: 2026-05-19
**Status**: Done
**Input**: `docs/audit/AUDIT_2026-05-18.md` (S15,S16,S17,S19,S20 + infra gaps)
**Decision log**: `docs/audit/REMEDIATION_DOT4.md`

## Problem

Hạ tầng chưa cứng: container chạy root (S16), deployment records mất khi recreate (S15), `npm run validate` silent-pass khi thiếu Foundry/Slither (S17), không pin Node ⇒ Node 25 phá tooling (S19), runbook trỏ path sai (S20), không healthcheck backend ⇒ FE chạy trước BE, không có local chain offline.

## Goal

Hạ tầng portable, an toàn hơn: non-root, persist deployment, gate analysis trung thực, Node LTS pin, docs đúng path, health-gated bring-up, tuỳ chọn local chain. Đo: `dotnet build` 0 error, `docker compose config` hợp lệ (kể cả profile), `npm test` 9/9.

## User Stories

- **US1 (S16)** Container non-root: backend `USER app`, frontend `USER node` + chown. Test: compose config hợp lệ; Dockerfile có USER.
- **US2 (S15)** Persist + health: named volume `holihu_deployments`, backend `/health` + healthcheck, FE `depends_on: service_healthy`. Test: compose config hợp lệ; endpoint /health build OK.
- **US3 (S17)** Validate trung thực: thiếu Foundry/Slither ⇒ exit≠0, chỉ bỏ qua khi `SKIP_FOUNDRY=1`/`SKIP_SLITHER=1` tường minh + cảnh báo to.
- **US4 (S19)** Pin Node LTS: `engines node >=20 <23` (2 package.json) + `.nvmrc` 20.
- **US5 (S20)** Docs đúng: runbook path `E:\test_thacsi\blockchain` → `E:\Sach\Sua\blockchain_baucu`.
- **US6** Local chain opt-in: service `anvil` profile `local-chain`.

## Requirements

- **FR-001 (S16)**: backend & frontend container chạy non-root, thư mục cần ghi được chown.
- **FR-002 (S15)**: deployment records persist qua recreate; FE chỉ start sau khi BE healthy.
- **FR-003 (S17)**: missing-tool ⇒ non-zero; opt-out phải tường minh + loud.
- **FR-004 (S19)**: engines + .nvmrc chặn Node ngoài 20–22.
- **FR-005 (S20)**: 3 runbook chính hết path stale.
- **FR-006**: `anvil` opt-in qua compose profile, không ảnh hưởng stack mặc định.

## Success Criteria

- **SC-001**: `dotnet build` 0 error (có `/health`).
- **SC-002**: `docker compose config` hợp lệ (mặc định & `--profile local-chain`).
- **SC-003**: contracts `npm test` 9/9 (không đụng contract).
- **SC-004**: `runFoundryTests`/`runSlitherAnalysis` exit≠0 khi thiếu tool, không opt-out.

## Out of Scope (follow-up)

- Tự deploy `ElectionFactoryV1` lên anvil + set `FACTORY_ADDRESS` (chỉ có service local chain).
- Sửa path stale trong `blockchain_sm/testing/**` README legacy.
- Sửa Docker image `ghcr.io/crytic/echidna/echidna` cho forge/slither (untestable ở đây — ghi nhận).
- Pin Node trên máy host (ngoài tầm repo) — `.nvmrc`/engines tín hiệu cho team/CI.
