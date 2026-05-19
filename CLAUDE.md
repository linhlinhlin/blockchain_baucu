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

- **Spec-Driven Development** qua Spec-Kit. Hiến chương: `.specify/memory/constitution.md` — **Principle I (Security & Integrity First) là blocker tuyệt đối**.
- Backlog: `docs/audit/REMEDIATION_BACKLOG.md`. Đợt 1 (Critical): `.specify/specs/001-security-remediation-critical/`.
- Pipeline: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Mỗi spec atomic, tham chiếu mã issue `S#` từ audit.
- Thay đổi tối thiểu, đúng scope spec; không mở rộng bề mặt legacy; không commit secret.

<!-- SPECKIT START -->
- **Active feature**: `010-ux-professionalization` — kế hoạch: `.specify/specs/010-ux-professionalization/plan.md` (Đợt 10: chuyên nghiệp hoá UX/UI 5 trang app + shell, frontend-only, bảo toàn S4/S5).
<!-- SPECKIT END -->

## Cảnh báo bảo mật đang mở (xem audit §2)

5 Critical (S1–S5): private key commit trong `frontend/src/test/**`; OTP plaintext/echo; JWT secret hardcode; vote-secret plaintext localStorage. **Chưa vá** — đang chờ team duyệt scope Đợt 1.
