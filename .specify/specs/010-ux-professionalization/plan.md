# Implementation Plan: Đợt 10 — Chuyên nghiệp hoá toàn diện UX/UI

**Branch**: `010-ux-professionalization` | **Date**: 2026-05-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `.specify/specs/010-ux-professionalization/spec.md`

## Summary

Nâng cấp UX/UI 5 trang app active + khung ứng dụng cho nhất quán, chuyên nghiệp, hết "địa ngục cuộn" — **giữ nguyên** ngôn ngữ thị giác Apple-like sáng + accent xanh (`design.md` + `index.css`), **không** đổi thương hiệu, **không** dark mode.

Cách tiếp cận: nguyên nhân gốc của "loạn" KHÔNG phải thiếu primitive (đã có ~54 Radix + bộ token clay/apple trong `index.css`) mà là **5 trang đang tự chế 100% JSX với class `.clay-*` lặp lại, không tái dùng component nào**; trang dài 1028–1340 dòng cuộn một mạch; không có breadcrumb/page-header; IA sidebar lẫn lộn flow active với route legacy. Vì vậy:

1. **Hợp nhất token** (nguồn sự thật trong `index.css`) + thêm thang trạng thái ngữ nghĩa tối thiểu (success/warning/danger/info) cho badge/toast/phase — không trang trí.
2. **Một lớp component dùng chung mỏng** `src/components/ui/clay/` xây trên token clay + Radix sẵn có (DropdownMenu/Tabs/Select/Dialog đã có): Button, Field, Panel, StatusBadge, Tabs, Stepper/Wizard, DataTable (sort/filter/paginate client-side), Pagination, DropdownButton, Breadcrumb, PageHeader, SummaryRail (sticky), EmptyState, Skeleton/Loader, và helper `notify` (1 hệ toast).
3. **Khung + IA**: `AppShell` thêm PageHeader + Breadcrumb suy ra từ bảng `routeMeta`; sidebar được sắp xếp lại theo flow active, mobile drawer có bẫy tiêu điểm + Esc.
4. **Làm lại lần lượt 5 trang** theo P1→P3, tái dùng lớp component, tổ chức theo Wizard/Tab/section + sticky summary; **bảo toàn tuyệt đối** state/handler nghiệp vụ và bất biến bảo mật S4/S5.

Phân phối theo lát cắt độc lập (US1..US6), mỗi lát kiểm thử/bàn giao được.

## Technical Context

**Language/Version**: TypeScript ~5.8, React 18.3, ES2020+ (frontend). Backend ASP.NET Core `net9.0` — **không đụng trong Đợt 10**.
**Primary Dependencies**: Vite 6, Tailwind 3.4, Radix UI (đã cài đủ: dropdown-menu, tabs, select, dialog, popover, accordion, scroll-area…), `react-hot-toast` (hệ toast active đã chuẩn), `framer-motion` (đã có, cho drawer), `lucide-react` (icon). **Không thêm thư viện UI mới.**
**Storage**: N/A cho UX (ElectionV1 đọc qua `electionV1Api`; on-chain Sepolia qua ethers v6). Không thay đổi.
**Testing**: `tsc --noEmit` (gate active path); Jest hiện có cho unit nhẹ; kiểm thử thao tác theo `quickstart.md` (5 luồng). Không thêm framework test.
**Target Platform**: Trình duyệt hiện đại; desktop 1440×900 là khổ tham chiếu SC-001; responsive tới ~360px.
**Project Type**: Web app (frontend SPA) — chỉ phạm vi `frontend/`.
**Performance Goals**: Không hồi quy thời gian tải; danh sách dài render mượt qua phân trang/vùng cuộn có kiểm soát; không thêm bundle nặng (tái dùng lib sẵn có).
**Constraints**: Light-only; single-accent (mở rộng tối thiểu cho trạng thái ngữ nghĩa — xem Complexity Tracking); thay đổi tối thiểu đúng scope; không secret; không tăng bề mặt legacy; không đụng `frontend/src/test/**`; bảo toàn S4/S5 verbatim.
**Scale/Scope**: 5 trang app active + khung shell + ~16 component dùng chung. Dữ liệu bầu cử quy mô nhỏ (file-based O(10–100)) → đủ cho lọc/phân trang client-side.

## Constitution Check

*GATE: Phải pass trước Phase 0. Tái kiểm sau Phase 1.*

| Principle | Đánh giá | Kết luận |
|---|---|---|
| **I. Security & Integrity First (NON-NEGOTIABLE)** | Chỉ đổi trình bày/UX. Bất biến **S4** (mã hoá vote-secret bằng khoá dẫn xuất từ chữ ký ví, localStorage chỉ chứa `{iv,ciphertext,voter,electionAddress}`) và **S5** (kiểm `envelope.voter === connected address` trước reveal/decrypt) được pin verbatim trong `research.md` và là invariant cấm sửa khi tái cấu trúc `QuanLySmartContractPage`. OTP không echo/không plaintext giữ nguyên ở `VoterVerificationPage`. Không secret mới. Sanitize (S8/DOMPurify) không bị gỡ; không thêm `dangerouslySetInnerHTML`. | **PASS** (có guardrail tường minh) |
| **II. Auditability** | spec → plan → tasks → commit, tham chiếu `file:line`. Hành vi nhạy cảm (deploy/commit/reveal/finalize/bind ví) không đổi luồng, chỉ đổi vỏ. | **PASS** |
| **III. Simplicity / Legacy Freeze** | Tái dùng Radix + token clay sẵn có; lớp `ui/clay/` là **hợp nhất** (thay class-builder lặp mỗi trang) không phải mở rộng. Không lib UI mới. Không đụng legacy (`src/test/**`, trang không-active, AA stack). KHÔNG sửa BE. | **PASS** (2 mục biện minh ở Complexity Tracking) |
| **IV. Spec-Driven & Surgical** | ≥3 surface + đụng trang bảo mật → đi pipeline Spec-Kit (đang làm). Thay đổi tối thiểu đúng scope; mỗi task có verify cụ thể. | **PASS** |
| **V. Reproducibility** | Không đổi toolchain (Node 20/22 LTS; Vite 6). Tài liệu trỏ path thực. | **PASS** |

**Security Baseline**: không secret git ✔ · không làm yếu commit-reveal/eligibility (không đụng contract/luồng) ✔ · S4/S5 pin ✔.

→ **Cổng Hiến chương: PASS.** Không có vi phạm không-biện-minh.

## Project Structure

### Documentation (this feature)

```text
.specify/specs/010-ux-professionalization/
├── plan.md              # (file này)
├── spec.md              # /speckit-specify
├── research.md          # Phase 0 — quyết định kỹ thuật + bất biến S4/S5
├── data-model.md        # Phase 1 — mô hình IA + danh mục component dùng chung
├── quickstart.md        # Phase 1 — 5 luồng kiểm thử thao tác + quality gate
├── contracts/
│   ├── component-api.md  # Hợp đồng API của lớp component dùng chung
│   └── route-ia.md       # Hợp đồng IA: route → breadcrumb/title/section
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks (KHÔNG tạo ở bước này)
```

### Source Code (repository root) — chỉ `frontend/`

```text
frontend/src/
├── index.css                       # [SỬA] hợp nhất token + thang trạng thái ngữ nghĩa
├── styles/
│   └── tokens.css                  # [TUỲ CHỌN] tách token nếu index.css quá tải (giữ 1 nguồn sự thật)
├── components/
│   ├── ui/clay/                    # [MỚI] lớp component dùng chung (trên token clay + Radix)
│   │   ├── Button.tsx  Field.tsx  Panel.tsx  StatusBadge.tsx
│   │   ├── Tabs.tsx    Stepper.tsx  Wizard.tsx  DataTable.tsx
│   │   ├── Pagination.tsx  DropdownButton.tsx  Breadcrumb.tsx
│   │   ├── PageHeader.tsx  SummaryRail.tsx  EmptyState.tsx
│   │   ├── Loader.tsx  Skeleton.tsx
│   │   ├── notify.ts               # wrapper 1 hệ toast (react-hot-toast)
│   │   └── index.ts                # barrel export
│   ├── Sidebar.tsx                 # [SỬA] IA gọn + drawer a11y (focus-trap + Esc)
│   └── …                            # (không đụng component legacy ngoài scope)
├── AppAfterLogin.tsx               # [SỬA] gắn PageHeader + Breadcrumb từ routeMeta
├── routes/
│   ├── AppRoutes.tsx               # (không đổi cây route; chỉ đọc để dựng routeMeta)
│   └── routeMeta.ts                # [MỚI] map path → {title, breadcrumb, section}
└── pages/
    ├── TaoCuocBauCuPage.tsx        # [SỬA] US3 — Wizard 4 bước + SummaryRail sticky
    ├── QuanLySmartContractPage.tsx # [SỬA] US4 — master-detail + Tabs + phase header (S4/S5 BẤT BIẾN)
    ├── CuocBauCuCuaNguoiDungPage.tsx # [SỬA] US5 — DataTable + filter/paginate client-side + EmptyState
    ├── VoterVerificationPage.tsx   # [SỬA] US6 — Stepper (email→OTP→bind ví), lỗi inline
    └── QuetMaQRPage.tsx            # [SỬA] US6 — bố cục gọn + component dùng chung
```

**Structure Decision**: SPA hiện hữu, chỉ đụng `frontend/src`. Lớp dùng chung đặt ở **`components/ui/clay/`** (namespace mới) thay vì sửa 54 file `components/ui/*` legacy Radix — giữ legacy đóng băng (Principle III), giảm bề mặt rủi ro, và là nơi 5 trang import vào. Cây route giữ nguyên; IA shell suy ra từ `routeMeta.ts` (không đổi `AppRoutes.tsx`).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Thang màu trạng thái ngữ nghĩa (success/warning/danger/info) ngoài "single blue accent" của `design.md` | Bảng điều khiển bầu cử PHẢI truyền đạt trạng thái pha/kết quả: `finalized` vs `canceled` vs lỗi vs cảnh báo. Một sắc xanh duy nhất không phân biệt được "thành công" với "huỷ" → sai lệch nhận thức ở thao tác commit/reveal/finalize (rủi ro vận hành). | "Chỉ xanh + chữ" đã thử ngầm ở trang hiện tại: trạng thái lẫn lộn, người dùng phải đọc kỹ chữ. Trạng thái ngữ nghĩa chỉ dùng cho badge/toast/phase-chip (chức năng), trang trí vẫn single-blue → vi phạm tối thiểu, có kiểm soát. |
| Tạo namespace `components/ui/clay/` song song `components/ui/*` legacy | 54 file Radix legacy 5 trang **không import**; retrofit chúng = bề mặt sửa lớn + rủi ro hồi quy các trang non-active đang dùng chúng. | Sửa trực tiếp `components/ui/*` legacy: đụng trang ngoài scope, tăng rủi ro & bề mặt, mâu thuẫn "thay đổi tối thiểu" và "đóng băng legacy". Namespace mới cô lập sạch, dễ kiểm toán. |

*Mọi mục khác: không vi phạm — tái dùng, hợp nhất, không thêm lib, không đụng BE/legacy/contract.*
