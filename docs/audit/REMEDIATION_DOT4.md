# REMEDIATION Đợt 4 — Hạ tầng Hardening

- **Spec**: `.specify/specs/004-infra-hardening/` · **Branch**: `004-infra-hardening` (stack trên 003) · **Ngày**: 2026-05-19

## S16 — Container chạy root → ĐÃ XỬ LÝ
- `docker/backend.Dockerfile`: `mkdir -p /workspace/blockchain_sm/deployments` + `chown -R app:app /app /workspace/blockchain_sm` + `USER app` (uid 1654 có sẵn trong aspnet .NET 9).
- `docker/frontend.Dockerfile`: `chown -R node:node /app` + `USER node` (uid 1000 có sẵn trong node:20).

## S15 — Deployment records mất khi recreate + không healthcheck → ĐÃ XỬ LÝ
- `Program.cs`: `GET /health` (AllowAnonymous) trả `{status:"ok"}`.
- `docker-compose.active.yml`: named volume `holihu_deployments:/workspace/blockchain_sm/deployments`; backend `healthcheck` curl `/health`; frontend `depends_on: backend: condition: service_healthy` (hết race FE-trước-BE).

## S17 — `validate` silent-pass khi thiếu Foundry/Slither → ĐÃ XỬ LÝ
`runFoundryTests.js` / `runSlitherAnalysis.js`: thiếu Docker+tool ⇒ **exit 1** (in lỗi rõ), chỉ bỏ qua khi `SKIP_FOUNDRY=1`/`SKIP_SLITHER=1` tường minh (in cảnh báo to). `npm run validate` không còn pass với 0 analysis.
- Ghi nhận follow-up: image `ghcr.io/crytic/echidna/echidna` có thể không chứa `forge`/`slither` (audit S17) — không sửa ở đây vì không kiểm chứng được Docker image trong môi trường này; nên đổi sang `ghcr.io/foundry-rs/foundry` + `ghcr.io/trailofbits/eth-security-toolbox`.

## S19 — Node 25 phá tooling → ĐÃ XỬ LÝ (mức repo)
`engines: node >=20 <23` ở `frontend/package.json` + `blockchain_sm/package.json`; `.nvmrc`=20. Host hiện vẫn Node 25 (ngoài tầm repo) ⇒ full `tsc`/`vite build` vẫn chưa chạy được tại máy này; nhưng team/CI dùng đúng LTS sẽ chạy full gate. Đây là lý do các đợt verify FE bằng scoped typecheck.

## S20 — Runbook path drift → ĐÃ XỬ LÝ
`DOCKER_ACTIVE_STACK.md`, `CURRENT_APP_ELECTIONV1_RUNBOOK.md`: `E:\test_thacsi\blockchain` → `E:\Sach\Sua\blockchain_baucu`. (Runbook không nêu .NET version cụ thể nên không cần sửa version; `CLAUDE.md`/spec đã đúng net9.) README legacy trong `blockchain_sm/testing/**` còn path cũ — follow-up (legacy harness).

## Local chain (opt-in)
`docker-compose.active.yml`: service `anvil` (`ghcr.io/foundry-rs/foundry`, chain-id 31337, port 8545) dưới profile `local-chain`. Bật bằng `docker compose --profile local-chain up`. Tự deploy factory + set `FACTORY_ADDRESS` lên anvil = follow-up.

## Verify
| Hạng mục | Kết quả |
|---|---|
| `dotnet build` | **0 error** (có `/health`) |
| `docker compose config` | **VALID** (mặc định) |
| `--profile local-chain` | services = anvil/postgres/backend/frontend (parse đúng) |
| Contracts | không đụng contract; `npm test` 9/9 giữ nguyên |
| S17 scripts | exit≠0 khi thiếu tool; opt-out tường minh |

Không chạy full `docker compose up` (side-effecting, lâu, cần pull image + Sepolia). Verify ở mức config + build — đủ cho hạ tầng-as-code.
