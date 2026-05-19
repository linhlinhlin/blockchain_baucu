# Implementation Plan: Đợt 12 — Legal pages dark→light re-theme

**Branch**: `012-legal-light-retheme` · 2026-05-19 · [spec.md](./spec.md)

## Summary
Áp bản đồ token cố định (`research.md`) lên 2 file pháp lý bằng `replace_all` chuỗi
màu (hex + Tailwind off-system). framer-motion/ToC/scroll không chứa hex → an toàn.
Cổng: `npm run typecheck:active`=0 (2 file đã trong include từ Đợt 11) + grep
SC-001/002 + diff chỉ đổi class màu.

## Technical Context
TS/React/Vite/Tailwind; chỉ `frontend/src/pages/{ChinhSachBaoMatPage,DieuKhoanSuDungPage}.tsx`.
Không BE/Redux/route/lib/secret/legacy. Light-only (Đợt 7).

## Constitution Check
- **I. Security**: trang pháp lý không có logic bảo mật; chỉ đổi chuỗi màu → PASS.
- **II. Auditability**: spec→plan→tasks→commit; diff = chuỗi màu → PASS.
- **III. Simplicity/Legacy**: replace_all tối thiểu, 0 lib, không legacy → PASS.
- **IV. Surgical**: chỉ presentation; framer-motion/DOM bất biến → PASS.
- **V. Reproducibility**: cổng `typecheck:active` committed → PASS.
→ Cổng Hiến chương PASS. Complexity Tracking: trống.

## Project Structure
```
.specify/specs/012-legal-light-retheme/{spec,plan,research,tasks}.md, checklists/
frontend/src/pages/ChinhSachBaoMatPage.tsx   # [SỬA] replace_all màu
frontend/src/pages/DieuKhoanSuDungPage.tsx   # [SỬA] replace_all màu
```
**Structure Decision**: 2 file, replace_all theo bản đồ research; 0 đổi cấu trúc.
