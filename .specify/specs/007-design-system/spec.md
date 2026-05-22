# Feature Specification: Đợt 7 — Enforce Design System (Apple-like, de-slop)

**Feature Branch**: `007-design-system` (stack trên 006)
**Created**: 2026-05-19 · **Status**: Done (central enforcement) · polish follow-up ghi nhận
**Input**: User feedback "toàn bộ trang xấu, rối mắt, AI slop"; rule sẵn có `frontend/design.md`
**Decision log**: `docs/audit/REMEDIATION_DOT7.md`

## Problem

Token đã Apple-hoá + có guardrail (`bg-gradient-to*`/`shadow-*`/`font-bold`), NHƯNG markup inline trong pages vẫn tạo "slop": blob `bg-[radial-gradient(...)]`, bo cực tròn không nhất quán `rounded-[20..32px]`, panel trắng bán trong suốt `bg-[rgba(255,255,255,0.x)]`, **4–5 màu kẹo** (hồng/xanh lá/cyan/vàng/ube) vi phạm "single blue accent" của `design.md`, input/button bo full-pill 999px khắp nơi, blur quá đà.

## Goal

Enforce `design.md` (Apple: no decorative chrome, single blue accent, một radius tĩnh lặng, surface phẳng đặc, hierarchy trầm) **ở tầng trung tâm `src/index.css`** → toàn app sạch mà **không sửa từng page** (Constitution IV surgical, karpathy không over-rewrite). Đo: không còn blob/màu kẹo/bo cực tròn render ra; build/jest không đổi.

## Requirements

- **FR-001**: Vô hiệu mọi `bg-[radial|linear|conic-gradient(...)]` inline (blob trang trí) — guardrail cũ chỉ bắt `bg-gradient-to-*`.
- **FR-002**: Chuẩn hoá radius: mọi `rounded-[16..32px]` → 14px thống nhất; pill (`rounded-full`/999px) giữ cho tag/CTA.
- **FR-003**: Surface phẳng đặc: `bg-[rgba(255,255,255,0.x)]` → `--clay-surface`.
- **FR-004**: Single accent: tint màu kẹo (`252,121,129`/`132,231,165`/`59,211,253`/`248,204,101`/`193,176,255`…) → `--clay-surface-soft` + text về `--clay-text`.
- **FR-005**: `.clay-input`/`.clay-button` bo 999px → 12px (rect tinh tế); pill chỉ còn ở `.clay-pill`/`.clay-badge`/CTA login (`.metamask-login-action`/`.apple-cta`).
- **FR-006**: Tắt `backdrop-blur`/`blur-2xl|3xl` quá đà.
- **FR-007**: Chỉ sửa `src/index.css` (trung tâm). KHÔNG sửa page. Reversible thuần CSS.

## Success Criteria

- **SC-001**: index.css phục vụ chứa guardrail Đợt 7; frontend HTTP 200; Vite HMR áp dụng.
- **SC-002**: scoped tsc/jest KHÔNG đổi (thay đổi thuần CSS).
- **SC-003**: Toàn app: 0 blob gradient, 0 màu kẹo, radius nhất quán 14px, input/button rect 12px — tuân `design.md`.

## Out of Scope (polish follow-up — REMEDIATION_DOT7)

- Tinh chỉnh spacing rhythm/typographic scale per-page theo từng tile `design.md` (cần thiết kế từng trang, rủi ro/churn cao — làm dần khi có review thị giác).
- Gỡ hẳn các div blob trang trí khỏi JSX (giờ đã vô hiệu bằng CSS — sạch về thị giác; dọn JSX là cleanup phụ).
- Light/dark, motion polish.
