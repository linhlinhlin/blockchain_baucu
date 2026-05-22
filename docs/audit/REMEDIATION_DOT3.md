# REMEDIATION Đợt 3 — Dọn legacy

- **Spec**: `.specify/specs/003-legacy-cleanup/`
- **Branch**: `003-legacy-cleanup` (stack trên 002)
- **Ngày**: 2026-05-19

## Follow-up 2026-05-20

- Backend legacy AA/private-chain cleanup completed: removed `BlockchainService`, `BundlerService`, `SessionService`, `BlockchainServerService`, hosted services, legacy controllers, `LegacyBlockchainSettings`, AA ABIs, `UserOperation`, `KhoaPhien`, and `BlockchainTransaction`.
- Active web2 wallet lookup remains through `IBlockchainLookupService`; no legacy chain writer is registered.
- Frontend route/import cleanup completed for the active bundle; no suspicious reachable legacy UI surface remains.

## Phương pháp

Một agent phân tích import-closure từ entry thực `src/index.tsx` + `AppRoutes.tsx` (207 reachable / 424). Chỉ xóa **cụm dead 0-blocker** đã xác minh không file reachable nào import (verify lại bằng grep pattern import chính xác → 0 match). Vite chỉ bundle file reachable ⇒ xóa dead không phá runtime.

## Đã xóa (frontend, dead, an toàn)

- `src/testWeb3/**` (toàn bộ)
- `src/test/**` — **trừ** `src/test/components/use-toast.ts` + `toast.tsx` (đang được `QuanLyVaiTroAdminPage` active dùng; giữ tại chỗ, ghi nhận ngoại lệ). Xóa toàn bộ phần còn lại (gồm tàn dư key S1 cũ — đã sạch tuyệt đối).
- `src/abi/ContractABIs.tsx` (ABI AA stack legacy)
- `src/utils/blockchain.ts` (hardcode `geth.holihu.online`), `src/utils/bundler-sdk.tsx`
- `src/pages/ThamGiaBauCuPage.tsx`, `src/pages/QuanLyPhienBauCuPage.tsx`
- `src/components/bophieu/**` (9 file)

Verify: `grep` pattern import chính xác cho mọi module đã xóa → **0 file reachable import**.

## Dependency đã gỡ (11, hoàn toàn unused — 0 import toàn `src`)

`@azure/storage-blob`, `tsparticles`, `react-tsparticles`, `react-beautiful-dnd`, `@types/react-beautiful-dnd`, `web-vitals`, `json-server`, `qrcode.react`, `aos`, `@types/aos`, `@types/react-helmet`, `react-swipeable`. `npm install` gỡ **134 package**. Giữ `jest/ts-jest/@types/jest` (suite active `electionCreateFlow.test.ts` test code reachable), `@tinymce`, `react-helmet`, `react-international-phone` (còn dùng ở code reachable).

## Smart contract (S11 + contracts-audit)

- `contracts/flow/SimpleElectionFlow.sol` → `legacy/contracts/` (ra khỏi build path Hardhat `sources=contracts/`) — S11 đóng (không còn deployable nhầm).
- `ignition/modules/HoLiHuDeployment.ts` → `legacy/ignition/` (wire AA stack đông băng, mâu thuẫn freeze).
- `test/flow/` → `legacy/test-flow/`, `scripts/flow/` → `legacy/scripts-flow/`; gỡ 3 npm script `test:flow`/`deploy:flow:election`/`seed:flow:elections`.
- Verify: `npm run compile` OK, `npm test` **9/9 pass** (gate không đụng flow).

## Quyết định scope (ghi nhận trung thực)

1. **Backend legacy cleanup ? completed in follow-up 2026-05-20.** The original dot3 deferred this because active web2 controllers still injected legacy services. The follow-up decoupled those controllers and removed the AA/private-chain runtime stack while retaining DB wallet lookup.
2. **Deep dead-code purge ? completed for active bundle in follow-up 2026-05-20.** Remaining references to legacy terms in this document are historical evidence, not active source behavior.

## Trạng thái verify

| Hạng mục | Verify |
|---|---|
| FE deletions | 0 file reachable import module đã xóa; vite tree-shake dead |
| FE deps | `npm install` gỡ 134 pkg, lockfile khớp package.json |
| Contracts | `npm run compile` OK; `npm test` 9/9 |
| Backend | Follow-up 2026-05-20: `dotnet build WebApplication3/WebApplication3/WebApplication3.sln -c Debug -v:minimal` OK |
| Active jest | `electionCreateFlow.test.ts` (xem kết quả commit) |

Giới hạn Node 25 (full `tsc`/`vite build` bất khả thi) vẫn áp dụng — pin Node LTS là **Đợt 4 (S19)**, lúc đó chạy được full build để xác nhận bundle sạch sau dọn legacy.
