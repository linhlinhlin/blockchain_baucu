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

## Follow-up (ngoài scope Đợt 10)
- Dead code: helper trình bày mồ côi trong `QuanLySmartContractPage.tsx` (1-745,
  panelClasses/commandButtonClasses/messagePanelClasses/phaseAccentClasses) — cố ý
  KHÔNG gỡ để không đụng vùng đã qua cổng S4/S5; dọn ở đợt sau.
- Lỗi tsc pre-existing repo-wide (vite types/store immer) — đợt kỹ thuật riêng.
- Trang công khai/marketing + đo SC-001 runtime — đợt sau / người dùng xác nhận.
