# Kiến trúc — HoLiHu Blockchain Election

Tài liệu kiến trúc hợp nhất (nguồn sự thật). Xem kèm: `.specify/memory/constitution.md`,
`docs/adr/`, `docs/audit/AUDIT_2026-05-18.md`. ADR 0002 ghi quyết định KHÔNG
rewrite DDD big-bang (giữ kiến trúc layered, có biện minh).

## 1. Tổng quan

Hệ bầu cử sinh viên on-chain. Giá trị cốt lõi: đúng quy trình, dễ kiểm toán,
dễ vận hành — KHÔNG phô diễn công nghệ. Kiến trúc **layered thực dụng** (không
DDD/CQRS — biện minh ở ADR 0002), tối ưu cho quy mô vừa + rủi ro toàn vẹn cao.

```
Browser ──HTTPS──> Frontend (React/Vite SPA)
                       │  ethers v6 (ký commit/reveal trực tiếp ví)
                       ▼
                   Backend ASP.NET Core net9.0  ──EF Core──> PostgreSQL 17
                       │   (eligibility, roster, OTP, JWT, file)
                       ▼
                 Ethereum Sepolia  ──  ElectionFactoryV1 / ElectionV1
                                       (commit-reveal, Merkle eligibility)
```

## 2. Module map

| Path | Stack | Vai trò |
|---|---|---|
| `blockchain_sm/` | Hardhat 2.22 + Foundry + Solidity 0.8.28, OZ v5 | `ElectionFactoryV1`/`ElectionV1` (commit-reveal) = active; `legacy/` AA stack = đóng băng |
| `WebApplication3/.../WebApplication3/` | ASP.NET Core net9.0 | API `/api/election-v1/*`; legacy sau cờ `LegacyBlockchainSettings.Enabled` |
| `frontend/` | React 18 + Vite 6 + TS, ethers v6, Redux Toolkit | 5 trang app + công khai; lớp `components/ui/clay` (Đợt 10–12) |
| `docker/` + `docker-compose.active.yml` | postgres17 + backend net9 + frontend | active stack (`up --build`) |

## 3. Backend (layered)

`Controllers/` (23 — API surface, versioned `election-v1`, `[Authorize]`/RBAC,
`[EnableRateLimiting]`) → `Service/`+`Services/` (logic: ElectionV1Read/Roster,
Jwt, Email, Recaptcha…) → `Data/` `ApplicationDbContext` (EF Core,
**provider-aware** SqlServer/Postgres — S12) → `Models/` (entity + DTO).
`Program.cs` = composition root: DI, JwtBearer (fail-fast secret S3,
HMAC-SHA256, ClockSkew=0), CORS (config-driven S10), RateLimiter
(`voter-invites` 20/phút), `/health`.

**Biên giới:** Controller không chạm DbContext trực tiếp ngoài read mỏng;
logic nghiệp vụ ở Service; bí mật chỉ qua config/env (không hardcode).
**Namespace:** đã hợp nhất dưới `WebApplication3.Services` (ADR 0002 #2 —
RESOLVED 2026-05-20: sửa 1 file lạc `PinataService` + 2 using mồ côi,
`dotnet build` 0 error). Tên folder `Service/`↔`Services/` cosmetic (C#
namespace ≠ folder) — cố ý không churn (karpathy/Principle IV).

## 4. On-chain (nguồn toàn vẹn)

`ElectionV1`: **commit-reveal domain-separated** + **Merkle eligibility** (OZ
v5) + chặn double-commit/reveal/replay/reentrancy; `finalize` có ngưỡng
turnout/cờ low-turnout (S9). Backend chỉ giữ phần cần kiểm chứng
(eligibility, roster, liên kết ví). Bí mật phiếu (salt/commitment) **không
plaintext** ở client (S4: AES-GCM, khoá dẫn xuất chữ ký ví; S5: kiểm
`voter===connected` trước reveal).

## 5. Frontend

React/Vite SPA. `routes/AppRoutes.tsx` (createBrowserRouter, **route-level
lazy** — Đợt 13, main chunk 1769→427kB). State: Redux Toolkit slices +
TanStack Query. **Design system**: `components/ui/clay/*` (Đợt 10 — bộ
component dùng chung trên token clay/Apple-like sáng + Radix); `notify` = 1
hệ toast. Auth: access token chỉ ở memory (redux), refresh token =
HttpOnly+Secure cookie. Verify type: `npm run typecheck:active`
(`tsconfig.active.json`) = 0.

## 6. Bảo mật (tóm tắt — chi tiết `docs/audit/`)

S1–S13 + S15–S17 + S19–S20 RESOLVED (kiểm chứng 2026-05-20,
`SECURITY_VERIFICATION_2026-05-20.md`). JWT hardened, OTP hash BCrypt +
lockout + rate-limit, XSS DOMPurify, CORS config, vote-secret mã hoá.
Principle I (Security & Integrity First) = blocker tuyệt đối cho mọi đổi.

## 7. Governance & quy trình (điểm mạnh kiến trúc)

- **Spec-Driven Development** qua Spec-Kit: mỗi đợt = spec→plan→research→
  tasks→implement, atomic, tham chiếu mã `S#`.
- **ADR** (`docs/adr/`) cho quyết định kiến trúc; **audit** (`docs/audit/`,
  `REMEDIATION_DOT*`) cho remediation; cổng chất lượng `typecheck:active`=0
  + diff verbatim cho bất biến bảo mật (S4/S5, auth/OTP).
- Quy ước: thay đổi tối thiểu/surgical; không mở rộng legacy; không secret
  trong git; light-only design (Đợt 7).

## 8. Quyết định & Non-goals

- **Layered, KHÔNG DDD/CQRS/Clean-multi-project** — biện minh ADR 0002
  (YAGNI; quy mô/rủi ro; repo tham chiếu cũng layered).
- Non-goals: thêm tầng/lib chỉ để "giống dự án khác"; rewrite hệ đang chạy đã
  audit; dark mode; mở rộng AA stack legacy (đóng băng — Principle III).

## 9. Build / run

- Contracts: `cd blockchain_sm && npm run compile && npm test` (hardhat local).
- Backend: `dotnet build WebApplication3/WebApplication3/WebApplication3.sln -c Debug` (SDK 9).
- Frontend: Node 20/22 LTS; `npm install --legacy-peer-deps`; `npm run dev` / `build`; `npm run typecheck:active`.
- Full stack: `docker compose -f docker-compose.active.yml up --build` (FE :3000, BE :5293, PG :5432).
