# REMEDIATION S1 — Private key bị commit trong repo

- **Spec**: `.specify/specs/001-security-remediation-critical/` (US1, FR-001, FR-002)
- **Ngày xử lý**: 2026-05-18
- **Branch**: `001-security-remediation-critical`
- **Mức**: Critical (Constitution Principle I — blocker)

## Tóm tắt

Audit phát hiện private/session key 64-hex hardcode trong code legacy (luồng account-abstraction cũ trên private chain `geth.holihu.online` — đã đóng băng). Vì đã nằm trong git, **mọi key này coi như COMPROMISED vĩnh viễn** (Constitution: key từng lộ phải coi như đã lộ). Đã xóa khỏi tip; key không được tái sử dụng trên bất kỳ mạng nào.

## Hành động đã thực hiện

1. Xóa 4 file legacy chứa key (không nằm trên active route — chỉ được import bởi `src/test/**` khác):
   - `frontend/src/test/utils/createElection.js`
   - `frontend/src/components/election-session-manager/complete-election-workflow.js`
   - `frontend/src/test/ThuPhienBauCu.tsx`
   - `frontend/src/test/ThemCuTriPage.tsx`
2. `frontend/tsconfig.json`: thêm `exclude` `src/test`, `src/testWeb3` để typecheck active path không vỡ vì import legacy dangling (interim — Đợt 3 xóa toàn bộ legacy tree).
3. Suy ra address + kiểm tra trạng thái trên Sepolia (public RPC) để xác nhận mức rủi ro.

## Bảng key đã lộ → trạng thái

| Vị trí cũ | Address | Sepolia | Trạng thái |
|---|---|---|---|
| `createElection.js:34` | `0x1921255087b9d6C0a6772284C7Ff445784a4B8a9` | 0 ETH, 0 tx | COMPROMISED — chưa dùng, không funded |
| `complete-election-workflow.js:36` | `0x4817136f2Fc1fC2622638B38188a951ec3a34040` | 0 ETH, 0 tx | COMPROMISED — chưa dùng, không funded |
| `complete-election-workflow.js:210` | `0x9c94B000d007a41284df66C4d6204AB2Ac8cfd9E` | **0.000008 ETH, 1 tx** | COMPROMISED — **đã từng dùng trên Sepolia**, còn dust không đáng kể; cấm tái sử dụng |
| `complete-election-workflow.js:214` | `0x0671FE3C25e955B3818444b3714EB7B08a1e30bd` | 0 ETH, 0 tx | COMPROMISED — chưa dùng, không funded |
| `complete-election-workflow.js:218` | `0xC1d2F0975Cd2329f2Ee7CAB64BD729335C5b30f4` | 0 ETH, 0 tx | COMPROMISED — chưa dùng, không funded |
| `complete-election-workflow.js:222` | `0xbAf3a8941FebB356a3A72feb8ea8030D251459aE` | 0 ETH, 0 tx | COMPROMISED — chưa dùng, không funded |
| `ThuPhienBauCu.tsx:15` | `0xeded3df16327A54333F62a4ddC00369D89BdD9e9` | 0 ETH, 0 tx | COMPROMISED — chưa dùng, không funded |
| `ThemCuTriPage.tsx:315` | `0xed30804500C86feA9eA364C707C1E50fAdbD2150` | 0 ETH, 0 tx | COMPROMISED — chưa dùng, không funded |

**Kết luận rủi ro tài chính**: Không có địa chỉ nào giữ giá trị đáng kể (tối đa ~0.000008 ETH dust). Các key này thuộc luồng legacy private-chain đã decommission. Không cần sweep dust; **tuyệt đối không tái sử dụng** bất kỳ key nào ở trên cho dev/staging/prod.

## False positives đã loại (KHÔNG phải secret — giữ nguyên)

Scan 64-hex còn match các chuỗi sau, đã xác minh **không phải private key**, không xử lý:
- `blockchain_sm/examples/simple-flow-election.sample.json` — `candidateId` (keccak hash)
- `frontend/src/utils/blockchain.ts:289` — giá trị metadata "Hash kiểm chứng" (sẽ xóa ở Đợt 3 vì legacy geth URL, không phải vì key)
- `WebApplication3/.../Services/ElectionV1ReadService.cs:16` — hằng `ZeroBytes32` (toàn số 0)
- `WebApplication3/.../Service/BundlerService.cs:1144` — `userOpTypeHash` (keccak typehash, legacy)
- `frontend/src/test/components/admin-dashboard.tsx:47,49,51,68` — event signature topics (keccak)
- `frontend/src/test/DeployElectionPage.tsx:581` — txHash mẫu giả `0x1234…def` (placeholder, không có giá trị)

## Out of scope (đã ghi ở spec)

- Git history rewrite/purge (BFG/filter-repo): các key vẫn còn trong history cũ. Vì tất cả đã coi như compromised + không funded, rủi ro tồn dư bằng 0. Nếu team muốn purge history sẽ tách spec riêng.
- Xóa toàn bộ legacy tree (`src/test/**`, `ContractABIs.tsx`, `utils/blockchain.ts`, …) → **Đợt 3**.

## Verify

- `git status`: 4 file ở trạng thái `D` (deleted).
- Re-scan private-key 64-hex trên file committed: chỉ còn false positives ở bảng trên, **0 private/session key thật**.
