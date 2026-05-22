# Feature Specification: Đợt 8 — App Shell Redesign theo ảnh tham chiếu

**Feature Branch**: `008-dashboard-redesign` (stack trên 007)
**Created**: 2026-05-19 · **Status**: Shell done · in-page dashboard table = increment kế
**Input**: Ảnh tham chiếu người dùng (dashboard HoLiHu BlockVote — sidebar phẳng + topbar chips + bảng ballot + card trạng thái)
**Decision log**: `docs/audit/REMEDIATION_DOT8.md`

## Problem

Sidebar cũ bọc mỗi nhóm trong 1 hộp viền riêng (nhiều card lồng → rối, không giống ảnh). Ảnh yêu cầu một **rail phẳng** chuyên nghiệp: logo block, search, nhóm QUẢN LÝ/CÔNG CỤ nhãn nhỏ, item active nền xanh nhạt, user card đáy; nội dung nền xám nhạt, card trắng viền mảnh.

## Goal

Dựng lại **app shell** (Sidebar + AppAfterLogin) bám sát ảnh — vì shell hiển thị trên **mọi trang /app** nên đây là đòn bẩy thị giác cao nhất, **rủi ro thấp** (chỉ điều hướng/trình bày, không đụng logic bầu cử — Constitution I/IV). Giữ nguyên props/route/UserMenu/mobile.

## Scope đã làm

- **Sidebar.tsx** viết lại: rail phẳng cố định `--sidebar-w=264px`, logo vuông bo 12px, ô search bo 10px, nhóm "Quản lý"/"Công cụ"/"Quản trị" nhãn uppercase mảnh, item active = `--clay-primary-light` + chữ/icon xanh, hover `surface-soft`; UserMenu trong card viền đáy; icon chuyển sang lucide (đồng bộ). Mobile: top bar 60px + drawer. Route giữ nguyên (reuse path cũ) ⇒ không gãy điều hướng.
- **AppAfterLogin.tsx**: bỏ logic collapse 296/104, dùng `md:ml-[var(--sidebar-w)]` + `mt-[60px]` mobile (đơn giản, khớp ảnh).
- **index.css**: thêm token `--sidebar-w: 264px`.

## Out of Scope (increment kế — ghi nhận trung thực)

Dựng lại **trang dashboard** (`QuanLySmartContractPage` 1028 dòng — console commit/reveal) thành đúng bảng ballot trong ảnh (topbar chips ElectionV1·Sepolia/Ví/ETH, toolbar lọc, table trạng-thái-chấm-màu, pagination, card "Trạng thái kết nối"). Đây là build lớn trên trang chứa logic bầu cử trọng yếu — phải làm cẩn thận, kiểm thử để **không phá commit/reveal/finalize** (Constitution I). Tách Đợt 9.

## Success Criteria

- **SC-001**: scoped tsc Sidebar/AppAfterLogin → 0 lỗi do thay đổi.
- **SC-002**: Vite HMR áp dụng, FE HTTP 200.
- **SC-003**: Điều hướng mọi route active còn hoạt động (path giữ nguyên).
- **SC-004**: Shell khớp ảnh: rail phẳng trắng, nhóm nhãn, active xanh nhạt, user card đáy, nội dung nền xám + offset 264px.
