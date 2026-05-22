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

## Bổ sung — hoàn tất khớp toàn bộ ảnh (pass 2, presentational)

- **Thanh 4 bước** "Thông tin / Lựa chọn / Cử tri / Xác nhận": `<nav>` chips số, **anchor THẬT** tới section id (`#sec-thongtin`, `#positions-section`, `#sec-cutri`, `#sec-xacnhan`) — không fake stepper, click cuộn tới đúng phần (dùng `scroll-margin` sẵn). Bước 1 active.
- **Grid 2-cột field**: Tên cuộc bầu cử | Group key cạnh nhau (bỏ `md:col-span-2`), Mô tả full; section lịch `md:grid-cols-3 → md:grid-cols-2`.
- **Header section gọn**: mọi `clay-label`+`h2 text-2xl` → "Bước N" + `h2 text-lg` (Bước 1 Thông tin / Bước 2 Lựa chọn-ứng viên / Bước 3 Lịch-cử tri / Bước 4 Xác nhận) — đồng bộ ảnh.
- **Card "Xác thực"** cột phải: Email "Sẵn sàng" + QR/OTP (Sẵn sàng nếu roster, "Tắt (nhập ví)" nếu wallets) với chấm xanh — đúng ảnh.
- Toàn bộ vẫn presentational; `<form>`/handler/submit/state **bảo toàn**; scoped tsc 0 lỗi do thay đổi (363/468 vẫn là nợ legacy có sẵn); Vite HMR áp sạch, FE 200.

## Không làm (cố ý — trung thực)

- KHÔNG đổi nút submit thật ("Tạo election trên Sepolia"/"Tạo roster") thành "Tiếp tục" như mockup: đó là hành động tạo on-chain thật, mạo "Tiếp tục" sẽ đánh lừa người dùng (Constitution: report/UX trung thực). Giữ nhãn đúng ngữ nghĩa, chỉ đồng bộ kiểu dáng.

> Hard-refresh (Ctrl+Shift+R) trang `/app/tao-phien-bau-cu` để thấy header gọn + chips + Tóm tắt, đồng bộ với shell/dashboard.
