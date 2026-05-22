# CLAUDE.md — HoLiHu Blockchain Election (`blockchain_baucu`)

Hệ thống bầu cử sinh viên on-chain. Monorepo 4 module.

> ⚠️ **`SYSTEM_MODERNIZATION_REVIEW_2026-04-10.md` ĐÃ LỖI THỜI.** Repo đã đi xa hơn nó (backend là `net9.0` không phải net8; không còn AutoMapper; frontend đã gỡ react-scripts/next/web3; Web3Context đã ở Sepolia). **Nguồn sự thật về trạng thái hiện tại:** `docs/audit/AUDIT_2026-05-18.md`.

## Module map

| Path | Stack | Vai trò |
|---|---|---|
| `blockchain_sm/` | Hardhat 2.22 + Foundry + Solidity 0.8.28, OZ v5 | `ElectionFactoryV1`/`ElectionV1` (commit-reveal) = active; `legacy/` AA stack = đóng băng |
| `WebApplication3/WebApplication3/WebApplication3/` | ASP.NET Core `net9.0` | API `/api/election-v1/*`; legacy blockchain services sau cờ `LegacyBlockchainSettings.Enabled` |
| `frontend/` | React 18 + Vite 6 + TS, ethers v6 | 5 page active; `src/test/**` = legacy chưa xóa |
| `docker/` + `docker-compose.active.yml` | postgres17 + backend .NET9 + frontend vite-dev | active stack |

## Build / run (đã verify trên máy này)

- Contracts: `cd blockchain_sm && npm run compile && npm test` — **dùng local hardhat**, KHÔNG `npx hardhat` (npx kéo Hardhat 3 → lỗi HHE22).
- Backend: `dotnet build WebApplication3/WebApplication3/WebApplication3.sln -c Debug` (SDK 9.0.2xx-preview build được; **không** pin .NET 8).
- Frontend: cần Node **20/22 LTS** (máy đang Node 25 — quá mới cho Vite 6); `npm install` hiện cần `--legacy-peer-deps` (sẽ hết sau Đợt 3).
- Stack: `docker compose -f docker-compose.active.yml up --build`.
- Theo global CLAUDE.md: prefix lệnh bằng `rtk` để tiết kiệm token.

## Quy trình làm việc

- **Kiến trúc**: nguồn sự thật hợp nhất `docs/ARCHITECTURE.md`; quyết định kiến trúc ở `docs/adr/` (ADR 0002: layered, KHÔNG rewrite DDD big-bang — có biện minh).
- **Spec-Driven Development** qua Spec-Kit. Hiến chương: `.specify/memory/constitution.md` — **Principle I (Security & Integrity First) là blocker tuyệt đối**.
- Backlog: `docs/audit/REMEDIATION_BACKLOG.md`. Đợt 1 (Critical): `.specify/specs/001-security-remediation-critical/`.
- Pipeline: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Mỗi spec atomic, tham chiếu mã issue `S#` từ audit.
- Thay đổi tối thiểu, đúng scope spec; không mở rộng bề mặt legacy; không commit secret.

<!-- SPECKIT START -->
- **Đã xong**: Đợt 10 (`010-ux-professionalization`) + 10.1 type-baseline + Đợt 11 + Đợt 12 (`012-legal-light-retheme`, re-theme legal dark→light) — tất cả DONE, `npm run typecheck:active` = 0. Chi tiết: `docs/audit/REMEDIATION_DOT10.md` + `REMEDIATION_DOT11.md`. Cổng tsc tái lập: `npm run typecheck:active` (`frontend/tsconfig.active.json`).
<!-- SPECKIT END -->

## Trạng thái bảo mật (đã kiểm chứng 2026-05-20)

**S1–S13 + S15–S17 + S19–S20 = RESOLVED** (Đợt 1–7; xác minh lại bằng code + test live 2026-05-20):
- **S1** private key trong `src/test/**`: file đã xoá; 0 private-key/secret hardcode trong source tracked (các 64-hex còn lại chỉ là Keccak typehash/ZeroBytes32/candidateId — công khai).
- **S2** OTP: hash BCrypt (`ElectionV1RosterService` `LastOtpCode`), dev-echo chỉ khi `DevelopmentAuthSettings:Enabled`, lockout 5 lần/15′, rate-limit `voter-invites` 20 req/phút.
- **S3** JWT: `Program.cs:47-55` fail-fast nếu `JwtSettings:Secret` thiếu/<32; **không có fallback hardcode**; HMAC-SHA256; validate issuer/audience/lifetime; `ClockSkew=0`; refresh-token cookie `HttpOnly`+`Secure(IsHttps)`+`SameSite`; access token chỉ ở memory (redux). Live: refresh không cookie→401, login sai→401 generic (không enumeration), không Set-Cookie khi fail.
- **S4/S5** vote-secret: AES-GCM khoá dẫn xuất từ chữ ký ví; kiểm `envelope.voter===connected` trước reveal (byte-identical, đã verify Đợt 10 + lại 2026-05-20).
- **S8** XSS: DOMPurify sanitize; **S10** CORS từ config (mặc định localhost, có `AllowCredentials` + origin cụ thể).

**Còn lại (rủi ro thấp/chấp nhận, KHÔNG blocker):** S14 (timestamp skew testnet — accepted), S18 (warning/RNG obsolete — Low), S19 (Node 25 vs LTS 20/22 — pin toolchain), S20 (runbook lệch path/version). Chi tiết: `docs/audit/AUDIT_2026-05-18.md` + `REMEDIATION_DOT*.md`. Production phải bật reCAPTCHA + JWT secret từ secret store.
