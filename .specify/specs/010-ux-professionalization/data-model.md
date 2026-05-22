# Phase 1 — Model: IA, Component Catalog & State-Preservation Map

UX feature → "entities" là **Information Architecture**, **danh mục component dùng chung**, và **bản đồ state/handler phải bảo toàn** khi tái cấu trúc.

## 1. Information Architecture (IA)

### Nhóm điều hướng sau đăng nhập (sidebar — sắp xếp lại, không thêm route)

| Nhóm | Mục | Path | Trạng thái Đợt 10 |
|---|---|---|---|
| **Bầu cử** | Bảng điều khiển | `/app/quan-ly-smart-contract` | US4 (P2) |
| | Tạo bầu cử | `/app/tao-phien-bau-cu` | US3 (P1) |
| | Danh sách bầu cử | `/app/user-elections` | US5 (P2) |
| **Cử tri** | Xác minh cử tri | `/verify-voter` | US6 (P3) |
| | Quét mã QR | `/app/quet-ma-qr` | US6 (P3) |
| **Khác** (giữ, de-emphasize) | Thông báo / Quản lý file / Quản trị | route hiện hữu | Ngoài scope nội dung; chỉ kế thừa shell/nav style |

> Thuật ngữ: thống nhất "bầu cử" (bỏ lẫn lộn "ballot/phiên/cuộc"). Mục active có icon + trạng thái active rõ (đã có cơ chế `navItemClass` `Sidebar.tsx:91-97`).

### Breadcrumb / PageHeader (suy từ `routeMeta.ts`)

`Trang chủ (/app) › <section> › <title trang>`. Mỗi trang có `PageHeader{ title, description?, actions? , breadcrumb }`. Hợp đồng chi tiết: `contracts/route-ia.md`.

## 2. Danh mục component dùng chung (`components/ui/clay/`)

| Component | Dựa trên | Trạng thái FR | Dùng ở |
|---|---|---|---|
| `Button` / `IconButton` | clay-button tokens | FR-004 | mọi trang |
| `Field` (label+hint+error+control) | clay-input/label | FR-004, FR-013 | Tạo bầu cử, Xác minh |
| `Panel` / `SectionCard` | clay-panel (18px) | FR-003/004 | mọi trang |
| `StatusBadge` | thang trạng thái D2 | FR-004 | Dashboard, Danh sách |
| `Tabs` | `@radix-ui/react-tabs` | FR-004/009 | Dashboard |
| `Stepper` + `Wizard` | tự dựng + framer-motion | FR-007/011 | Tạo bầu cử, Xác minh |
| `DataTable` (sort/filter/paginate, height-capped) | tự dựng + ScrollArea | FR-004/008/010 | Danh sách, Dashboard |
| `Pagination` | tự dựng | FR-010 | Danh sách |
| `DropdownButton` | `@radix-ui/react-dropdown-menu` | FR-004 | mọi trang (hành động phụ) |
| `Breadcrumb` | tự dựng + react-router | FR-001 | shell |
| `PageHeader` | tự dựng | FR-001 | shell |
| `SummaryRail` (sticky aside) | tự dựng + `position:sticky` | FR-007 | Tạo bầu cử, Dashboard |
| `EmptyState` | tự dựng | FR-006 | Danh sách, Dashboard, QR |
| `Loader` / `Skeleton` | tự dựng | FR-006 | mọi trang khi chờ on-chain/API |
| `notify` (helper, không phải component) | `react-hot-toast` | FR-005 | mọi trang |

Ràng buộc chung: vùng chạm ≥44px; `:focus-visible` rõ (đã có nền `index.css:89-92`); ARIA/label đầy đủ; không shadow trang trí (Đợt 7); một radius (18px card / pill CTA).

## 3. Bản đồ State/Handler PHẢI bảo toàn (refactor "lift JSX, keep logic")

### TaoCuocBauCuPage.tsx (US3) — 1340 dòng → Wizard 4 bước

- **State giữ nguyên (14)**: `title, description, groupKey, commitStart, commitEnd, revealEnd, voterMode, voterWalletsInput, rosterInput, positions, submitting, submitAttempted, activeDraft, message`.
- **Handler giữ nguyên**: `handleSubmit` (deploy `createElectionV1Group` / `createElectionV1RosterDraft`), `handleDeployVerifiedRoster` (`deployElectionV1RosterDraft`), CRUD vị trí/ứng viên, effect nạp draft (`getElectionV1RosterDraft`).
- **Ánh xạ bước**: B1 Thông tin (`title/description/groupKey`) · B2 Vị trí & ứng viên (`positions`) · B3 Lịch & cử tri (`commitStart/End/revealEnd/voterMode/...Input`) · B4 Xác nhận & triển khai (`handleSubmit`/`handleDeployVerifiedRoster` + QR roster). SummaryRail sticky hiển thị tiến độ + nút chính. Validation đẩy người dùng tới bước/field lỗi (FR-007 AC3). Chuyển bước **không** unmount form (giữ state).

### QuanLySmartContractPage.tsx (US4) — 1028 dòng → master-detail + Tabs

- **State giữ nguyên (11+memo)**: `publicConfig, groupItems, selectedGroupKey, groupDetail, selectedElectionAddress, detail, connectedAccount, walletBalance, busy, committingCandidateId, message, votePackageRevision`, memo `storedVoteEnvelope`.
- **Handler giữ nguyên**: `bootstrap, refreshGroup, refreshElection, refreshAll, loadWalletBalance, connectWallet, getSignerContext, handleCommitVote, handleRevealVote, handleFinalizeElection, openGroup`; chuỗi `useEffect` cascade (group→election) **giữ nguyên thứ tự**.
- **Bất biến bảo mật**: S4/S5 verbatim — xem `research.md` §INV. Tabs/section chỉ tổ chức lại vùng nhìn; phase header sticky; danh sách ứng viên → DataTable; hành động commit/reveal/finalize theo ngữ cảnh pha (disabled + lý do từ `getCommitReason/getRevealReason/getFinalizeReason`).

### CuocBauCuCuaNguoiDungPage.tsx (US5)

- Giữ nguồn dữ liệu `listElectionV1Groups()` (client-side). Thêm: ô tìm kiếm, filter theo phase, sort cột, `Pagination`, `EmptyState`. Không đổi API.

### VoterVerificationPage.tsx (US6)

- Giữ luồng OTP/bind ví & ràng buộc bảo mật (OTP không echo/không lưu plaintext nơi script chạm). Bọc vào `Wizard` 3 bước (email → OTP → bind ví), lỗi inline qua `Field`.

### QuetMaQRPage.tsx (US6)

- Giữ logic quét (`html5-qrcode`/`jsqr`) & handler. Chỉ tổ chức lại bố cục + dùng `EmptyState`/`Loader`/`StatusBadge`.

## 4. Định nghĩa "Done" theo lát cắt

Mỗi US PASS khi: (a) acceptance scenario trong `spec.md` đạt; (b) `tsc --noEmit` sạch active path; (c) luồng tương ứng trong `quickstart.md` chạy không hồi quy; (d) không secret/không tăng bề mặt legacy; (e) US4 thêm: đối chiếu 4 đoạn S4/S5 trước/sau khớp verbatim.
