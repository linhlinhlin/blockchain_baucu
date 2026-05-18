# Feature Specification: Đợt 6 — Cải thiện UX/UI (active path)

**Feature Branch**: `006-ux-ui-improvement` (stack trên 005)
**Created**: 2026-05-19 · **Status**: Done (High + safe Med/Low) · follow-up ghi nhận
**Input**: UX/UI review active path (agent) · **Decision log**: `docs/audit/REMEDIATION_DOT6.md`

## Problem

Active path thiếu feedback giao dịch blockchain (commit/reveal/finalize await im lặng nhiều giây → double-submit), lỗi bảo mật quan trọng (OTP lockout S2, vote-secret S4/S5) bị nuốt hoặc chôn trong status box nhỏ, thiếu a11y (modal không role/Escape, trạng thái chỉ bằng màu), copy lẫn lộn.

## Goal

Phản hồi rõ ràng & an toàn cho luồng bầu cử on-chain, không nới bề mặt legacy (Constitution III), thay đổi surgical low-risk. Đo: scoped typecheck 0 lỗi do thay đổi; active jest pass.

## User Stories

- **US1 (H1)** Commit có spinner/khoá: nút commit hiện `Đang commit…`+spinner đúng hàng, mọi nút commit disable khi busy ⇒ hết double-submit.
- **US2 (H2)** Reveal/Finalize phản ánh pending: label đổi `Đang xử lý giao dịch…`+spinner khi busy.
- **US3 (H3)** Lỗi/thành công tx nổi bật: `toast.error/success` (react-hot-toast đã mount) cho commit/reveal/finalize.
- **US4 (M1,M4)** Giữ message backend: QuetMaQRPage dùng `readableError` ⇒ lockout OTP "Còn N lần thử" (S2) & lỗi token tới được người dùng.
- **US5 (M2,L5)** Modal OTP a11y: `role=dialog` aria-modal aria-labelledby + Escape đóng + padding mobile `p-6 sm:p-8`.
- **US6 (M5,M6,L2,L4)** Rõ trạng thái: icon+nhãn+aria cho Đủ điều kiện/Đã commit/Đã reveal; hint chưa có ví; aria-label ô tìm; "Chưa thiết lập" thay "n/a"; Việt hoá nhãn viewer.

## Requirements

- **FR-001**: Hành động on-chain MUST có pending state hiển thị + chống double-submit.
- **FR-002**: Lỗi giao dịch/định danh MUST nổi bật (toast) + giữ nguyên message bảo mật từ backend (không nuốt/raw).
- **FR-003**: Modal OTP MUST có semantics dialog + đóng bằng Escape.
- **FR-004**: Trạng thái MUST không chỉ truyền bằng màu (icon/aria).
- **FR-005**: Thay đổi chỉ ở active path, surgical, không thêm dep nặng (tái dùng react-hot-toast + lucide đã có).

## Success Criteria

- **SC-001**: scoped typecheck file đụng → 0 lỗi do thay đổi.
- **SC-002**: active jest suite pass.
- **SC-003**: Không thêm dependency mới; không đụng legacy.

## Out of Scope (follow-up — REMEDIATION_DOT6 ghi rõ)

- H4 banner "MetaMask chưa cài" (hiện đã hiển thị qua toast/message — đủ tối thiểu).
- M3/M7 QuetMaQRPage: thay Radix Toast→react-hot-toast & migrate clay theme (visual refactor lớn hơn).
- L1/L3 localize toàn bộ heading kỹ thuật & dời cảnh báo vote-secret (polish rộng).
