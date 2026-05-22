# REMEDIATION Đợt 3 — Dọn legacy

- **Spec**: `.specify/specs/003-legacy-cleanup/`
- **Branch**: `003-legacy-cleanup` (stack trên 002)
- **Ngày**: 2026-05-19

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

1. **Backend legacy gating — KHÔNG làm ở Đợt 3 (deferred).** Audit infra đề nghị gate toàn bộ đăng ký legacy sau `LegacyBlockchainSettings.Enabled`. Nhưng controller web2 **active** (`TaiKhoanController`, `UngCuVienController`, `CuocBauCuController`) **vẫn inject** `BlockchainService`/`IBlockchainLookupService`/`BundlerService`/`SessionService`. Gate sẽ làm vỡ các controller active khi `Enabled=false` (compose đang đặt false). Decoupling đúng = refactor "thin backend" — effort riêng, ngoài scope dọn-file. Hosted services legacy (event listener, session cleanup) **đã** được gate sẵn (đúng).
2. **Deep dead-code purge — phần còn lại là follow-up.** Còn ~150 file dead misc + nhánh route-redirect legacy (ElectionSessionManagerPage, PhienBauCuBlockchainDeploymentPage, các `*WithId` wrapper, components blockchain/capphieu, ChinhSuaPhienBauCuPage…) bị `AppRoutes` static-import ⇒ phải route-surgery (xóa import + route block theo chuỗi). Rủi ro cao, churn lớn; để follow-up có kiểm thử UI. Đã xóa phần **giá trị bảo mật cao + 0-blocker** trước (key residue, geth URL, AA ABI, paymaster/session UI bophieu).

## Trạng thái verify

| Hạng mục | Verify |
|---|---|
| FE deletions | 0 file reachable import module đã xóa; vite tree-shake dead |
| FE deps | `npm install` gỡ 134 pkg, lockfile khớp package.json |
| Contracts | `npm run compile` OK; `npm test` 9/9 |
| Backend | Không đổi ở Đợt 3 (gating deferred có lý do) |
| Active jest | `electionCreateFlow.test.ts` (xem kết quả commit) |

Giới hạn Node 25 (full `tsc`/`vite build` bất khả thi) vẫn áp dụng — pin Node LTS là **Đợt 4 (S19)**, lúc đó chạy được full build để xác nhận bundle sạch sau dọn legacy.
