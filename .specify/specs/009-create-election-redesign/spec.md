# Feature Specification: Đợt 9 — Trang Tạo bầu cử theo ảnh mẫu

**Feature Branch**: `009-create-election-redesign` (stack trên 008)
**Created**: 2026-05-19 · **Status**: Header+summary done · field-grid/stepper = polish kế
**Input**: Ảnh mẫu #2 (trang "Tạo đợt bầu cử": header gọn + chips, form 2 cột, card Tóm tắt/Xác thực)
**Decision log**: `docs/audit/REMEDIATION_DOT9.md`

## Problem

`TaoCuocBauCuPage.tsx` (1258 dòng, Critical-path tạo election) đang là hero khổng lồ: badge + `h1` 5xl "Tạo một đợt bầu cử gồm nhiều chức vụ…" + 4 MetricCard to. Ảnh mẫu: **header gọn** "Tạo đợt bầu cử" + subtitle 1 dòng + hàng **chips trạng thái** (ElectionV1·Sepolia / Ví / địa chỉ / mạng / JWT), cột phải card **Tóm tắt**.

## Goal

Bám ảnh mẫu mà **không đụng logic tạo election** (Constitution I): chỉ restyle phần trình bày header + cột phải, giữ nguyên toàn bộ `<form>`, state, handler, submit, chế độ cử tri, MetaMask.

## Scope đã làm (surgical)

- **Header** (hero → gọn): bỏ badge + h1 5xl + 4 MetricCard; thay bằng `clay-label` + `h1` 2xl/3xl "Tạo đợt bầu cử" + subtitle 1 dòng + **hàng chips** (ElectionV1·Sepolia, Ví đã/chưa kết nối với chấm xanh, địa chỉ mono, Sepolia/Sai mạng, JWT) — dùng đúng biến sẵn có (`currentAccount`, `isNetworkConnected`, `accessToken`, `shortenAddress`).
- **Cột phải**: thêm card **Tóm tắt** (Mạng/Hợp đồng/Ví/Tài khoản/JWT — list label↔value), relabel "Quick actions"→"Hành động" trong khối có viền phân tách; giữ nguyên nút Kết nối MetaMask / Về console / Live status / RequirementList.
- Tận dụng token Đợt 7 (radius/màu/shadow) + shell Đợt 8 ⇒ đồng bộ ngôn ngữ thiết kế toàn app.

## Out of Scope (polish kế — ghi nhận trung thực)

- 4-step strip ("Thông tin/Lựa chọn/Cử tri/Xác nhận") đúng kiểu wizard: trang hiện không phải wizard state-driven; làm stepper thật = đổi luồng (rủi ro Critical-path) → cân nhắc riêng, không fake.
- Tinh chỉnh grid field 2-cột từng input + card "Xác thực" Email/QR-OTP "Sẵn sàng": cần đụng sâu vùng form (≥600 dòng) — làm từng khối có kiểm thử để không phá tạo election.

## Success Criteria

- **SC-001**: scoped tsc vùng sửa → 0 lỗi do thay đổi (lỗi 363/468 là nợ legacy có sẵn).
- **SC-002**: Vite HMR áp sạch, FE HTTP 200, log không lỗi.
- **SC-003**: `<form>` + handler + submit create-election bảo toàn (chỉ sửa header/aside trình bày).
- **SC-004**: Header gọn + chips + card Tóm tắt khớp khung ảnh mẫu, đồng bộ shell Đợt 8.
