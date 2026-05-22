# Quickstart — Verify Đợt 10 (no-regression + UX gates)

Môi trường: Node 20/22 LTS, `cd frontend && npm install --legacy-peer-deps`, `npm run dev`. Backend không đổi (không cần build .NET).

## A. Quality gate (chạy mỗi lát cắt + trước commit)

| Gate | Lệnh | PASS khi |
|---|---|---|
| Type | `cd frontend && npx tsc --noEmit` | 0 lỗi ở active path |
| Secret | rà `git diff` | không key/secret/OTP mới |
| Legacy | rà diff | không sửa `frontend/src/test/**`, không import lib UI mới, không thêm route legacy |
| S4/S5 | so 4 đoạn `research.md §INV` trước/sau | khớp **verbatim**, đúng vị trí trong luồng |

## B. 5 luồng nghiệp vụ — không hồi quy (SC-004)

1. **Tạo bầu cử → triển khai**: `/app/tao-phien-bau-cu` → điền B1..B4 qua Wizard → triển khai. Kỳ vọng: mỗi bước trong tầm nhìn (không cuộn dài), SummaryRail luôn thấy, chuyển bước không mất dữ liệu, deploy ra `createElectionV1Group`/`RosterDraft` như cũ, điều hướng kết quả đúng.
2. **Commit → reveal → finalize** (`/app/quan-ly-smart-contract`, ví Sepolia): chọn group→ballot, commit 1 ứng viên, reveal, finalize. Kỳ vọng: phase header rõ, hành động đúng pha (sai pha disabled + lý do), **localStorage chỉ chứa `{iv,ciphertext,voter,electionAddress}`** (kiểm DevTools → không có `salt` plaintext), reveal bằng **ví khác** bị chặn đúng thông điệp S5.
3. **Xác minh cử tri** (`/verify-voter`): email → OTP → bind ví theo Wizard. Kỳ vọng: lỗi inline từng bước; OTP **không** echo ra UI/log/localStorage plaintext.
4. **Quét QR** (`/app/quet-ma-qr`): quét/nhập mã. Kỳ vọng: trạng thái đang quét/thành công/lỗi qua component dùng chung; có EmptyState khi chưa quét.
5. **Danh sách + lọc** (`/app/user-elections`): tìm kiếm, lọc theo phase, sort, phân trang. Kỳ vọng: phản hồi tức thì client-side, không cuộn toàn trang (DataTable height-capped), 0 kết quả → EmptyState có gợi ý.

## C. UX gates (đo được, theo Success Criteria)

| ID | Kiểm | PASS khi |
|---|---|---|
| SC-001 | Khổ 1440×900, mở Tạo bầu cử & Bảng điều khiển | Hành động chính + điều hướng bước/tab thấy **không cuộn**; chiều cao cuộn tối đa giảm ≥40% so baseline (đo bằng DevTools `document.body.scrollHeight` trước/sau) |
| SC-002 | grep active path | chỉ `react-hot-toast` (qua `notify`); không `sweetalert2/sonner/react-toastify` ở 5 trang |
| SC-003 | rà `file:line` | 5 trang import `components/ui/clay`; không còn class-builder lặp tự chế (`panelClasses/inputClasses/actionButtonClasses`...) ở trang |
| SC-005 | Tab-only + trình đọc | mọi control tới được bằng bàn phím, focus-visible rõ, Esc đóng drawer/menu, target ≥44px, tương phản ≥ AA |
| SC-006 | mục A | tất cả gate A xanh |
| SC-007 | Kịch bản: 1 vị trí, 2 ứng viên, 3 cử tri | hoàn tất tạo qua Wizard, số lần cuộn giảm rõ, không lạc bước |

## D. Thứ tự bàn giao (mỗi mục là một lát cắt commit được)

US1 (shell+IA) → US2 (token+lớp component) → US3 (Tạo bầu cử) → US4 (Dashboard, kèm verify S4/S5) → US5 (Danh sách) → US6 (Xác minh + QR). Mỗi lát: chạy A + luồng B tương ứng + UX gate liên quan trước khi sang lát kế.
