# REMEDIATION — Đợt 10 (2026-05-19): Chuyên nghiệp hoá toàn diện UX/UI

**Branch:** `010-ux-professionalization` · **Spec-Kit:** `.specify/specs/010-ux-professionalization/`
(spec → plan → research → data-model → contracts → quickstart → tasks). Frontend-only.

## Mục tiêu
Nâng cấp hệ thiết kế Apple-like sáng hiện có cho nhất quán & chuẩn tổ chức lớn; diệt
"địa ngục cuộn"; chuẩn hoá điều hướng + bộ component dùng chung. Giữ light-only, không
đổi thương hiệu, không thêm lib UI, không đụng BE/contract/legacy.

## Đã làm (theo lát cắt, mỗi lát 1 commit)

| Lát | Nội dung | Commit |
|---|---|---|
| Spec-Kit | spec/plan/research/data-model/contracts/quickstart/tasks (43 task/9 phase) | `5a35e4a` |
| US1+US2 | Token trạng thái ngữ nghĩa (chỉ thêm, giữ Đợt 7); **16 component clay** (Button/Field/Panel/SectionCard/StatusBadge/Tabs/Stepper/Wizard/DataTable/Pagination/DropdownButton/SummaryRail/EmptyState/Loader/Skeleton/Breadcrumb/PageHeader) + `notify` (1 hệ toast) + barrel; `routeMeta`; shell breadcrumb; Sidebar IA (Bầu cử/Cử tri/Khác/Quản trị) + drawer Esc/focus-trap/role=dialog/≥44px | `d1ff38c` |
| US3 | Tạo bầu cử → Wizard 4 bước + SummaryRail sticky; validation đẩy đúng bước/field | `f5f76fe` |
| US5 | Danh sách → DataTable client-side (sort/lọc-phase/paginate) + EmptyState; KHÔNG đổi BE | `463883c` |
| US4 | Bảng điều khiển → master-detail + Tabs + phase header sticky | `9d4020c` |
| US6 | Xác minh cử tri → Stepper; Quét QR → clay re-skin | (US6 commit) |

## Bảo mật (Principle I — blocker tuyệt đối)
- **S4/S5 cổng cứng PASS**: refactor US4 chỉ JSON-only; `git diff HEAD` của
  `QuanLySmartContractPage.tsx` = 3 hunk (import clay / const detailTab / JSX return).
  **0 dòng** trong deriveVoteAesKey/encrypt/decrypt/loadStoredVoteEnvelope/
  saveStoredVoteEnvelope/voteEncMessage + check `envelope.voter===address` +
  commitVote/revealVote/tx.wait xuất hiện trong diff ⇒ mã hoá SAU commit & kiểm ví
  TRƯỚC reveal **byte-identical HEAD**. Tham chiếu: `s4s5-reference.md`.
- OTP: VoterVerification/QuetMaQR giữ `ModalOTP` + handler OTP verbatim (không echo
  OTP, không lưu plaintext nơi script chạm). Logic state/handler mọi trang verbatim.
- 0 secret mới · 0 tăng bề mặt legacy · không đụng `src/test/**` · BE/contract 0 đụng.

## Quality gate
- `tsc` (scoped, phủ toàn bộ file Đợt 10 + import graph): **0 lỗi mới do Đợt 10**.
  Còn 16 lỗi **pre-existing** repo (api `import.meta.env`, store `WritableDraft`,
  `TaoCuocBauCuPage` `sourceId` — xác nhận verbatim `HEAD:468`). Không tăng số lỗi.
- SC-002/003/005/006 PASS (xem `baseline-metrics.md`).
- Hạn chế: SC-001 (px cuộn) & SC-004/007 (thao tác) cần chạy `npm run dev`
  (Node 20/22 LTS) — agent không chạy trình duyệt; mọi verify tĩnh đã PASS.

## Đợt 10.1 (2026-05-19) — Type-baseline: active path `tsc` = 0

Xử lý **toàn bộ** 16 lỗi tsc pre-existing trong import-graph active path bằng
thay đổi **type-only / runtime-erased** (assertion/optional — KHÔNG đổi giá trị,
điều kiện, control-flow, hành vi, bảo mật). Mỗi sửa có comment `Đợt 10.1`.

| File | Lỗi pre-existing | Fix type-only |
|---|---|---|
| `src/vite-env.d.ts` (mới) | `import.meta.env` TS2339 ×2 (apiClient/publicApiClient) | `/// <reference types="vite/client" />` |
| `store/slice/nguoiDungSlice.tsx` | `WritableDraft` ×8 | `as unknown as typeof state.<field>` (immer Draft) |
| `store/slice/timTaiKhoanSlice.tsx` | `WritableDraft` ×1 | `as unknown as typeof state.foundUsers` |
| `store/slice/maOTPSlice.tsx` | shape literal lệ ×1 (legacy OTP) | `as unknown as typeof state.thongTinXacThuc` |
| `api/authenticate.tsx`, `api/authorize.tsx` | type-lie `searchCacTaiKhoan` ×3 | boundary `as unknown as` (KHÔNG đổi so sánh mật khẩu/role) |
| `pages/TaoCuocBauCuPage.tsx` | `sourceId` ×1 (verbatim logic) | `as unknown as { sourceId: string }` |

- **Cổng tái lập**: `frontend/tsconfig.active.json` + `npm run typecheck:active`
  → **0 lỗi** (đúng định nghĩa Hiến chương "tsc sạch ở active path"). Commit kèm.
- **S4/S5**: round này KHÔNG đụng `QuanLySmartContractPage.tsx` → bất biến giữ
  nguyên như commit `9d4020c` đã qua cổng PRE/POST.
- Nguyên tắc: assertion bị xoá lúc compile ⇒ 0 rủi ro Principle I. Không sửa
  hành vi auth/redux; lệ shape literal OTP legacy = follow-up cần spec riêng.

## Follow-up (ngoài scope)
- Dead code: helper trình bày mồ côi trong `QuanLySmartContractPage.tsx` (1-745) —
  cố ý KHÔNG gỡ để không đụng vùng đã qua cổng S4/S5; dọn ở đợt sau.
- Chuẩn hoá shape `thongTinXacThuc`/`searchCacTaiKhoan` (legacy auth/OTP) = cần
  spec có security-review (không hack hành vi để im lỗi).
- Lỗi tsc ở trang legacy KHÔNG thuộc active path (không nằm import-graph của 5
  trang) — Principle III freeze, không đụng.
- Trang công khai/marketing + đo SC-001 runtime — đợt sau / người dùng xác nhận.
