# REMEDIATION Đợt 9 — Trang Tạo bầu cử theo ảnh mẫu

- **Spec**: `.specify/specs/009-create-election-redesign/` · **Branch**: `009-create-election-redesign` (stack 008) · **Ngày**: 2026-05-19

## Đã làm (surgical — KHÔNG đụng logic tạo election)

`src/pages/TaoCuocBauCuPage.tsx`:
- **Header hero → gọn theo ảnh:** bỏ `clay-badge` + `h1` 5xl "Tạo một đợt bầu cử gồm nhiều chức vụ…" + 4 `MetricCard`; thay bằng `clay-label` "Tạo Ballot" + `h1` "Tạo đợt bầu cử" + subtitle 1 dòng + **hàng chips** (ElectionV1·Sepolia · chấm xanh "Ví đã/chưa kết nối" · địa chỉ mono · Sepolia/Sai mạng · JWT). Dùng đúng biến có sẵn (`currentAccount`, `isNetworkConnected`, `accessToken`, `shortenAddress`).
- **Cột phải:** thêm card **Tóm tắt** (Mạng/Hợp đồng/Ví/Tài khoản/JWT), relabel "Quick actions"→"Hành động" trong khối viền phân tách; giữ nguyên nút Kết nối MetaMask / Về console / Live status / RequirementList.
- Toàn bộ `<form>`, state, handler, submit, chế độ cử tri, MetaMask **bảo toàn** (chỉ sửa trình bày header/aside).

## Verify

- scoped tsc file → **0 lỗi do thay đổi** ở vùng sửa (564–655). Lỗi báo ở 363/468 là **nợ type legacy có sẵn** (cùng loại mọi đợt: `string|undefined`, `CandidateDraft.sourceId`), không phải Đợt 9.
- `docker cp` + Vite **HMR áp sạch** (`hmr update TaoCuocBauCuPage.tsx`), FE **HTTP 200**, log không lỗi.

## Follow-up (ghi nhận trung thực)

- **4-step strip wizard**: trang không phải wizard state-driven; làm stepper thật = đổi luồng tạo election (rủi ro Critical-path) → không fake, cân nhắc thiết kế lại luồng riêng.
- Tinh chỉnh grid 2-cột từng field + card "Xác thực" Email/QR-OTP: đụng sâu ≥600 dòng vùng form → làm từng khối có kiểm thử để không phá tạo election (Constitution I).

> Hard-refresh (Ctrl+Shift+R) trang `/app/tao-phien-bau-cu` để thấy header gọn + chips + Tóm tắt, đồng bộ với shell/dashboard.
