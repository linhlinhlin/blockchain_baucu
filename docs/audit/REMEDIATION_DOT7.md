# REMEDIATION Đợt 7 — Enforce Design System (de-slop)

- **Spec**: `.specify/specs/007-design-system/` · **Branch**: `007-design-system` (stack trên 006) · **Ngày**: 2026-05-19
- Rule tuân theo: `frontend/design.md` (ngôn ngữ Apple sẵn có trong repo) + Refactoring UI / Apple HIG (restraint, single accent, calm radius, flat surface, quiet hierarchy).

## Chẩn đoán

Token đã Apple-hoá + guardrail cũ (chỉ bắt `bg-gradient-to-*`, `shadow-*`, `font-bold`). Slop còn lại đến từ **markup inline trong pages** (đo trên 5 page active): 14× `rounded-[24px]`, 9× `rounded-[28px]`, panel `bg-[rgba(255,255,255,0.x)]`, và **màu kẹo** hồng/xanh lá/cyan/vàng/ube (vi phạm "single blue accent" của design.md) + blob `bg-[radial-gradient]`.

## Xử lý — chỉ sửa `src/index.css` (trung tâm, 0 sửa page)

| FR | Thay đổi |
|---|---|
| FR-005 | `.clay-input` & `.clay-button` border-radius `999px → 12px` (rect tinh tế; pill chỉ còn `.clay-pill`/`.clay-badge`/CTA login). |
| FR-001 | Guardrail: `[class*='bg-[radial/linear/conic-gradient']` → `background-image:none` (vô hiệu blob trang trí mọi page). |
| FR-002 | Guardrail: `rounded-[16/18/20/22/24/26/28/30/32px]` → `border-radius:14px` (một radius tĩnh lặng). |
| FR-003 | Guardrail: `bg-[rgba(255,255,255,0.x)]` → `--clay-surface` (surface phẳng đặc). |
| FR-004 | Guardrail: tint kẹo (`252,121,129`/`132,231,165`/`59,211,253`/`248,204,101`/`193,176,255`/`1,65,141,0.1`) → `--clay-surface-soft` + `color:--clay-text` (single accent). |
| FR-006 | Guardrail: `backdrop-blur`/`blur-2xl|3xl` → none. |

## Verify

- index.css phục vụ qua Vite **chứa guardrail Đợt 7**; frontend **HTTP 200**; áp dụng qua `docker cp` + Vite HMR (CSS hot-reload tức thì).
- Thay đổi **thuần CSS** ⇒ scoped tsc/jest KHÔNG đổi (không cần chạy lại — không đụng TS/JS).
- Hiệu lực toàn app ngay (mọi page dùng chung `index.css`), không sửa dòng JSX nào ⇒ surgical, reversible, không tăng rủi ro.

## Follow-up (ghi nhận trung thực)

- Tinh chỉnh **spacing rhythm & type scale từng trang** theo từng "tile" design.md (cần thiết kế thủ công per-page, churn lớn) — làm dần có review thị giác.
- Dọn hẳn div blob trang trí khỏi JSX (đã vô hiệu bằng CSS, sạch thị giác; xoá JSX là cleanup phụ, gộp vào deep dead-code purge follow-up Đợt 3).
- Light/dark & motion polish.

> Người dùng chỉ cần hard-refresh (Ctrl+Shift+R) để thấy giao diện tĩnh lặng, một màu nhấn, bo nhất quán, phẳng — đúng tinh thần đơn giản/tinh tế/hiệu quả.
