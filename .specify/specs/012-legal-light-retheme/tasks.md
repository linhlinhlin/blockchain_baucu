---
description: "Task list — Đợt 12 Legal light re-theme"
---

# Tasks: Đợt 12 — Legal pages dark→light re-theme

**Verify**: `npm run typecheck:active` + grep + `git diff`. Scope: chỉ 2 file pháp lý; không BE/Redux/route/lib/secret/legacy; framer-motion/ToC/scroll verbatim.

## Phase 1: Setup
- [X] T001 Xác nhận branch `012-legal-light-retheme`; ghi số `useScroll|useTransform|motion.|scrollIntoView|scrollTo` ref của 2 file (baseline bất biến). **Verify**: số ref ghi nhận.

## Phase 2: US1 — Re-theme (P1)
- [X] T002 [US1] `ChinhSachBaoMatPage.tsx`: replace_all theo `research.md` (hex dark→surface/text/muted; Tailwind off-system→clay/state). **Verify**: grep 0 hex bespoke/off-system; số ref framer-motion = baseline T001.
- [X] T003 [US1] `DieuKhoanSuDungPage.tsx`: như T002 (+ #6A1B9A/#01579B/#00796B). **Verify**: grep sạch; ref framer-motion = baseline.
- [X] T004 [US1] Checkpoint: `npm run typecheck:active`=0; `git diff` chỉ chứa thay đổi chuỗi class màu (không dòng `useScroll/useTransform/motion./scrollIntoView/scrollTo/nội dung`). **Verify**: tsc=0, diff sạch logic; commit.

## Phase 3: Polish
- [X] T005 SC-001/002/003 sweep + cập nhật `docs/audit/REMEDIATION_DOT11.md` (đánh dấu follow-up legal = DONE) + CLAUDE pointer. **Verify**: grep rỗng; commit.

## Notes
- Bất biến: framer-motion/ToC/scroll/DOM. SC-004 px runtime = người dùng (Node 20/22).
