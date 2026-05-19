---
description: "Task list — Đợt 10 UX/UI Professionalization"
---

# Tasks: Đợt 10 — Chuyên nghiệp hoá toàn diện UX/UI

**Input**: `.specify/specs/010-ux-professionalization/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)
**Tests**: KHÔNG sinh task test-suite (đây là tái cấu trúc UX). Verify = `tsc --noEmit` + đối chiếu `file:line`/diff + luồng thao tác `quickstart.md` (Hiến chương Principle IV: mỗi task có verify cụ thể).
**Scope guard (mọi task)**: frontend-only; KHÔNG đụng backend/contract; KHÔNG sửa `frontend/src/test/**` hay trang non-active; KHÔNG thêm thư viện UI mới; KHÔNG secret mới; giữ Đợt 7 guardrails & `design.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: chạy song song được (khác file, không phụ thuộc task chưa xong)
- **[Story]**: US1..US6 (theo spec.md)
- Mọi mô tả kèm đường dẫn file chính xác

---

## Phase 1: Setup

**Purpose**: Mốc nền & số liệu baseline để đo SC-001.

- [X] T001 Capture baseline: chạy `cd frontend && npm install --legacy-peer-deps && npm run dev`, mở `/app/tao-phien-bau-cu` và `/app/quan-ly-smart-contract` ở khổ 1440×900, ghi `document.body.scrollHeight` của mỗi trang vào `.specify/specs/010-ux-professionalization/baseline-metrics.md`. **Verify**: file tồn tại, có 2 số đo baseline.
- [X] T002 [P] Xác nhận `git branch --show-current` = `010-ux-professionalization` và `git status` sạch. **Verify**: đúng branch, tree sạch.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Token + hạ tầng lớp dùng chung mà MỌI user story cần.

**⚠️ CRITICAL**: Không US nào bắt đầu trước khi Phase 2 xong.

- [X] T003 Hợp nhất token trong `frontend/src/index.css`: thêm biến trạng thái ngữ nghĩa `--state-success/-warning/-danger/-info` + nền nhạt tương ứng (research §D2); KHÔNG đổi token clay/apple hiện có, KHÔNG đụng guardrail Đợt 7 (`index.css:790-896`). **Verify**: `npx tsc --noEmit` sạch; mở 1 trang bất kỳ — giao diện hiện tại KHÔNG đổi (token mới chưa dùng); `git diff index.css` chỉ thêm biến.
- [X] T004 [P] Tạo thư mục `frontend/src/components/ui/clay/` + `index.ts` (barrel rỗng có chú thích). **Verify**: `npx tsc --noEmit` sạch.
- [X] T005 [P] Tạo `frontend/src/components/ui/clay/notify.ts` bọc `react-hot-toast` (`success/error/info/promise`, top-right, thời lượng/kiểu nhất quán) theo `contracts/component-api.md`; KHÔNG mount provider mới (provider đã ở `AppAfterLogin.tsx:37`). **Verify**: `npx tsc --noEmit` sạch; import thử trong file scratch biên dịch; `grep` xác nhận không thêm `<Toaster>`/provider.
- [X] T006 [P] Tạo `frontend/src/routes/routeMeta.ts` với `ROUTE_META` + `resolveRouteMeta()` theo `contracts/route-ia.md`; KHÔNG sửa `AppRoutes.tsx`. **Verify**: gọi thử `resolveRouteMeta` cho 6 path (`/app`, 4 trang `/app/*`, `/verify-voter`) trả đúng title/section/breadcrumb; fallback không ném lỗi; `tsc` sạch.

**Checkpoint**: Token + barrel + notify + routeMeta sẵn sàng.

---

## Phase 3: User Story 1 — Khung ứng dụng & điều hướng nhất quán (P1) 🎯 MVP

**Goal**: Mọi trang app có breadcrumb/page-header + sidebar IA gọn + drawer mobile a11y.

**Independent Test**: Duyệt 5 trang → breadcrumb/title đúng, mục nav active đúng; thu nhỏ <768px → drawer mở/đóng bằng nút/nền/Esc, focus bị bẫy, target ≥44px.

- [X] T007 [P] [US1] Tạo `Breadcrumb.tsx` + `PageHeader.tsx` trong `frontend/src/components/ui/clay/` theo `contracts/component-api.md`; export qua barrel. **Verify**: `tsc` sạch.
- [X] T008 [US1] Gắn `PageHeader`+`Breadcrumb` vào `frontend/src/AppAfterLogin.tsx` (bọc `<Outlet/>`, dùng `resolveRouteMeta(useLocation().pathname)`); giữ nguyên skip-link, `<Toaster>`, `ThemeProvider`, layout `md:ml-[var(--sidebar-w)]`. **Verify**: mỗi trong 5 trang hiển thị title/breadcrumb đúng (spec FR-001 AC1); `tsc` sạch.
- [X] T009 [US1] Sắp xếp lại IA trong `frontend/src/components/Sidebar.tsx`: nhóm `Bầu cử`/`Cử tri`/`Khác` (data-model §1), thống nhất thuật ngữ "bầu cử", giữ cơ chế `navItemClass` active. KHÔNG xoá route; mục non-active đưa nhóm `Khác`. **Verify**: trạng thái active đúng trên 5 route; nhãn đồng bộ `routeMeta`.
- [X] T010 [US1] Drawer mobile a11y trong `Sidebar.tsx`: thêm đóng bằng `Esc`, focus-trap khi mở, `aria-modal`/`role="dialog"`, target ≥44px (mở rộng khối `Sidebar.tsx:184-206`). **Verify**: bàn phím — Esc đóng, Tab không thoát khỏi drawer khi mở; đo target ≥44px (spec FR-002 AC2/AC3).
- [X] T011 [US1] Checkpoint US1: quickstart §A (tsc/secret/legacy) + duyệt 5 trang không hồi quy điều hướng. **Verify**: `npx tsc --noEmit` sạch; 5 luồng điều hướng OK; commit lát US1.

**Checkpoint**: US1 hoạt động & test độc lập được (MVP khung).

---

## Phase 4: User Story 2 — Hệ thiết kế & bộ component dùng chung (P1)

**Goal**: Bộ component clay đầy đủ, a11y-by-default, tiêu thụ token; 1 hệ toast.

**Independent Test**: `tsc` sạch + đối chiếu từng component với `contracts/component-api.md` (props/variant/a11y/radius/no-shadow).

- [X] T012 [P] [US2] `clay/Button.tsx` (variant/size/loading/icon, active scale .95, focus-visible, lg≥44px). **Verify**: `tsc`; khớp contract.
- [X] T013 [P] [US2] `clay/Field.tsx` (label/hint/error/required; `htmlFor`/`aria-describedby`/`aria-invalid`). **Verify**: `tsc`; a11y attrs đúng.
- [X] T014 [P] [US2] `clay/Panel.tsx` + `SectionCard` (radius 18px, no decorative shadow). **Verify**: `tsc`; khớp Đợt 7.
- [X] T015 [P] [US2] `clay/StatusBadge.tsx` (tone success/warning/danger/info/neutral từ token T003). **Verify**: `tsc`; chỉ dùng token trạng thái.
- [X] T016 [P] [US2] `clay/Tabs.tsx` trên `@radix-ui/react-tabs`, `keepMounted` (không unmount panel). **Verify**: `tsc`; panel ẩn vẫn giữ DOM/state.
- [X] T017 [P] [US2] `clay/Stepper.tsx` + `clay/Wizard.tsx` (mọi panel mounted, chỉ ẩn/hiện; rail slot). **Verify**: `tsc`; chuyển bước không unmount.
- [X] T018 [P] [US2] `clay/DataTable.tsx` + `clay/Pagination.tsx` (sort/filter/paginate **client-side**, `maxBodyHeight` qua scroll-area, slot `empty`). **Verify**: `tsc`; không gọi API; chiều cao có trần.
- [X] T019 [P] [US2] `clay/DropdownButton.tsx` trên `@radix-ui/react-dropdown-menu` (item/separator, tone danger). **Verify**: `tsc`; bàn phím mở/chọn được.
- [X] T020 [P] [US2] `clay/SummaryRail.tsx` (sticky top ≥lg, xuống dưới <lg). **Verify**: `tsc`; sticky hoạt động.
- [X] T021 [P] [US2] `clay/EmptyState.tsx`. **Verify**: `tsc`; có slot action.
- [X] T022 [P] [US2] `clay/Loader.tsx` + `clay/Skeleton.tsx`. **Verify**: `tsc`.
- [X] T023 [US2] Export tất cả qua `frontend/src/components/ui/clay/index.ts`; tạo file scratch tạm import toàn bộ để smoke (xoá sau). **Verify**: `npx tsc --noEmit` sạch; barrel export đủ; KHÔNG thêm route mới.
- [X] T024 [US2] Checkpoint US2: rà từng component vs `contracts/component-api.md` (checklist) + quickstart §A. **Verify**: 100% contract đạt; `tsc` sạch; commit lát US2.

**Checkpoint**: US1 + US2 độc lập hoạt động.

---

## Phase 5: User Story 3 — Trang "Tạo bầu cử" hết "scroll hell" (P1)

**Goal**: `TaoCuocBauCuPage` thành Wizard 4 bước + SummaryRail sticky, tái dùng clay, bảo toàn logic.

**Independent Test**: Tạo bầu cử đầy đủ → triển khai; mỗi bước trong tầm nhìn; chuyển bước không mất dữ liệu; `createElectionV1Group`/`RosterDraft` như cũ.

- [X] T025 [US3] Tái cấu trúc `frontend/src/pages/TaoCuocBauCuPage.tsx` thành `Wizard` 4 bước (B1 Thông tin · B2 Vị trí&ứng viên · B3 Lịch&cử tri · B4 Xác nhận&triển khai) — "lift JSX, keep logic": GIỮ NGUYÊN 14 state + `handleSubmit`/`handleDeployVerifiedRoster`/CRUD/effect draft (data-model §3). **Verify**: `git diff` cho thấy tên biến state & handler KHÔNG đổi; `tsc` sạch.
- [X] T026 [US3] Thêm `SummaryRail` sticky (tiến độ + nút chính); validation đẩy tới bước/field lỗi (FR-007 AC3); danh sách cử tri trong `DataTable`/scroll height-capped (FR-008). **Verify**: nhập thiếu → nhảy đúng bước/field; danh sách dài không phình trang.
- [X] T027 [US3] Thay class-builder tự chế (`panelClasses/inputClasses/actionButtonClasses` trong file) bằng component clay; toast qua `notify`. **Verify**: `grep` trong `TaoCuocBauCuPage.tsx` không còn các helper builder; không import `toast` trực tiếp.
- [X] T028 [US3] Checkpoint US3: quickstart §A + luồng §B1 + SC-007; đo `scrollHeight` 1440×900 vs baseline T001 → giảm ≥40% (SC-001). **Verify**: số đo đạt; luồng tạo→triển khai không hồi quy; `tsc` sạch; commit lát US3.

**Checkpoint**: US1+US2+US3 độc lập; MVP P1 hoàn chỉnh.

---

## Phase 6: User Story 4 — Bảng điều khiển Smart Contract gọn (P2) 🔒 S4/S5

**Goal**: `QuanLySmartContractPage` → master-detail + Tabs + phase header sticky + DataTable, **bảo toàn verbatim S4/S5**.

**Independent Test**: commit→reveal→finalize trên Sepolia cho kết quả on-chain như cũ; localStorage không có salt plaintext; reveal sai ví bị chặn.

- [X] T029 [US4] PRE-GATE: trích **nguyên văn** 4 đoạn S4/S5 (research §INV: `voteEncMessage/deriveVoteAesKey/encryptVoteSecret/decryptVoteSecret`; mã hoá trong `handleCommitVote`; check trong `loadStoredVoteEnvelope`; check trong `handleRevealVote`) từ `QuanLySmartContractPage.tsx` hiện tại vào `.specify/specs/010-ux-professionalization/s4s5-reference.md`. **Verify**: file chứa đủ 4 đoạn + số dòng gốc.
- [X] T030 [US4] Tái cấu trúc `frontend/src/pages/QuanLySmartContractPage.tsx` → master-detail + `Tabs` + phase header sticky + `DataTable` ứng viên — GIỮ NGUYÊN 11 state + memo + `bootstrap/refreshGroup/refreshElection/refreshAll/connectWallet/getSignerContext/handleCommitVote/handleRevealVote/handleFinalizeElection` + thứ tự chuỗi `useEffect` cascade (data-model §3). KHÔNG tách handler S4/S5 khỏi điểm gọi on-chain. **Verify**: `git diff` — tên state/handler không đổi; `tsc` sạch.
- [X] T031 [US4] Thay layout tự chế bằng component clay; action rail theo pha dùng `getCommitReason/getRevealReason/getFinalizeReason` (disabled + lý do); toast qua `notify`. **Verify**: nút sai pha bị disabled kèm lý do (FR-009 AC1); `grep` không còn class-builder tự chế.
- [X] T032 [US4] POST-GATE: `diff` 4 vùng S4/S5 trong file mới vs `s4s5-reference.md` (T029) — phải **verbatim & đúng thứ tự** (mã hoá SAU commit on-chain; check `voter===address` TRƯỚC decrypt/reveal). **Verify**: diff rỗng cho 4 vùng; DevTools: localStorage chỉ `{iv,ciphertext,voter,electionAddress}` (không `salt`); reveal bằng ví khác → chặn đúng thông điệp S5.
- [X] T033 [US4] Checkpoint US4: quickstart §A + luồng §B2; đo `scrollHeight` vs baseline → giảm ≥40% (SC-001). **Verify**: số đo đạt; commit→reveal→finalize không hồi quy; `tsc` sạch; commit lát US4.

**Checkpoint**: US1–US4 độc lập; bất biến bảo mật giữ nguyên.

---

## Phase 7: User Story 5 — Danh sách bầu cử dạng bảng chuyên nghiệp (P2)

**Goal**: `CuocBauCuCuaNguoiDungPage` → DataTable + tìm/lọc-phase/sort/paginate client-side + EmptyState. KHÔNG đổi API.

**Independent Test**: gõ từ khoá / chọn phase → danh sách thu hẹp tức thì, phân trang đúng; 0 kết quả → EmptyState gợi ý.

- [X] T034 [US5] Tái cấu trúc `frontend/src/pages/CuocBauCuCuaNguoiDungPage.tsx` dùng `DataTable` (cột + sort), filter theo phase, `Pagination`, `EmptyState`; GIỮ nguồn dữ liệu `listElectionV1Groups()` (research §D4 — không sửa BE). **Verify**: `git diff` không đụng `electionV1Api`/API; lọc/sort/paginate client-side hoạt động; `tsc` sạch.
- [X] T035 [US5] Thay markup tự chế bằng component clay; toast qua `notify`. Checkpoint US5: quickstart §A + luồng §B5. **Verify**: §B5 đạt (FR-010 AC1/AC2); `tsc` sạch; commit lát US5.

**Checkpoint**: US1–US5 độc lập.

---

## Phase 8: User Story 6 — Xác minh cử tri & Quét QR (P3)

**Goal**: `VoterVerificationPage` → Wizard 3 bước; `QuetMaQRPage` gọn; bảo toàn bảo mật OTP/scan.

**Independent Test**: xác minh đi từng bước, lỗi inline, OTP không echo/plaintext; QR phản hồi trạng thái rõ.

- [X] T036 [P] [US6] Tái cấu trúc `frontend/src/pages/VoterVerificationPage.tsx` → `Wizard` (email→OTP→bind ví), lỗi inline qua `Field`; GIỮ luồng OTP/bind & ràng buộc bảo mật (OTP không echo, không lưu plaintext nơi script chạm). **Verify**: luồng §B3; `grep` không echo OTP ra UI/console/localStorage plaintext; `tsc` sạch.
- [X] T037 [P] [US6] Tái cấu trúc `frontend/src/pages/QuetMaQRPage.tsx` → bố cục gọn + `EmptyState`/`Loader`/`StatusBadge`; GIỮ logic quét (`html5-qrcode`/`jsqr`) & handler. **Verify**: luồng §B4; `tsc` sạch.
- [X] T038 [US6] Checkpoint US6: quickstart §A + luồng §B3 & §B4. **Verify**: cả hai đạt; `tsc` sạch; commit lát US6.

**Checkpoint**: Toàn bộ US1–US6 độc lập hoạt động.

---

## Phase 9: Polish & Cross-Cutting

- [X] T039 [P] Rà 5 trang: gỡ helper class-builder tự chế còn sót (SC-003). **Verify**: `grep -n` 5 trang không còn `panelClasses|inputClasses|actionButtonClasses|commandButtonClasses|messagePanelClasses` định nghĩa cục bộ; trang import `components/ui/clay`.
- [X] T040 [P] Quét a11y 5 trang: keyboard reachable, focus-visible, target ≥44px, tương phản ≥AA (SC-005). **Verify**: checklist a11y đạt từng trang.
- [X] T041 Quét active path: không `sweetalert2|sonner|react-toastify` import ở 5 trang (SC-002); `git diff package.json` không thêm lib UI. **Verify**: `grep` rỗng; package.json không đổi deps UI.
- [X] T042 Chạy đầy đủ quickstart §A + tất cả §B (5 luồng) + ghi số đo SC-001..SC-007 vào `baseline-metrics.md`. **Verify**: mọi gate xanh; `npx tsc --noEmit` sạch toàn active path.
- [X] T043 [P] Tạo `docs/audit/REMEDIATION_DOT10.md` (tóm tắt phạm vi/kết quả/đo lường, trỏ spec/plan; nêu giữ S4/S5) theo mẫu các đợt trước; xoá file scratch T023 & dọn `s4s5-reference.md` nếu không cần lưu. **Verify**: file tồn tại, link hợp lệ; không còn file tạm.

---

## Dependencies & Execution Order

- **Phase 1 Setup** → không phụ thuộc.
- **Phase 2 Foundational** → sau Setup; **chặn mọi US**.
- **US1 (P3)** sau Foundational. **US2 (P4)** sau Foundational (độc lập US1).
- **US3 (P5)** cần US2 (component) — và hưởng lợi US1.
- **US4 (P6)** cần US2; gồm gate S4/S5 (T029 trước T030, T032 sau T031).
- **US5 (P7)**, **US6 (P8)** cần US2.
- **Polish (P9)** sau khi các US mong muốn xong.

### Within story
- Component (US2) trước khi trang dùng (US3–US6).
- US4: T029 (PRE) → T030 → T031 → T032 (POST) → T033 (thứ tự cứng).
- "Lift JSX, keep logic": không đổi tên state/handler đã liệt kê (data-model §3).

## Parallel Opportunities

- Setup: T002 ∥ T001.
- Foundational: T004, T005, T006 ∥ (sau T003).
- US1: T007 ∥ (T008–T010 tuần tự cùng `Sidebar.tsx`/`AppAfterLogin.tsx`).
- US2: T012–T022 ∥ (file riêng) → T023 → T024.
- US6: T036 ∥ T037 (file khác nhau).
- Polish: T039, T040, T043 ∥; T041 trước T042.

## Implementation Strategy

### MVP (P1)
Setup → Foundational → US1 → US2 → US3 → **STOP & VALIDATE** (quickstart §A + §B1, SC-001/007). Bàn giao được.

### Incremental
US4 (kèm gate S4/S5) → US5 → US6, mỗi lát chạy §A + §B liên quan + đo SC trước khi sang lát kế. Commit sau mỗi checkpoint.

## Notes
- [P] = khác file, không phụ thuộc.
- Mỗi lát commit độc lập; dừng ở checkpoint để validate.
- Tránh: đổi tên state/handler, đụng cùng file song song, phụ thuộc chéo US phá tính độc lập.
- **Bất biến tuyệt đối**: S4/S5 verbatim (research §INV) — T029/T032 là cổng cứng của US4.
