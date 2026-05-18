# REMEDIATION Đợt 6 — Cải thiện UX/UI (active path)

- **Spec**: `.specify/specs/006-ux-ui-improvement/` · **Branch**: `006-ux-ui-improvement` (stack trên 005) · **Ngày**: 2026-05-19
- Nguồn: UX/UI review agent (active path: 5 page ElectionV1 + ModalOTP/layout). Surgical, không thêm dependency, không đụng legacy (Constitution III/IV).

## Đã làm

| ID | File | Thay đổi |
|---|---|---|
| **H1** | `QuanLySmartContractPage.tsx` | State `committingCandidateId`; nút commit hiện `Loader2`+"Đang commit…" đúng hàng; mọi nút commit `disabled` khi `busy` + `aria-busy` ⇒ hết double-submit (await on-chain im lặng). |
| **H2** | `QuanLySmartContractPage.tsx` | Nút Reveal/Finalize: spinner + "Đang xử lý giao dịch…" khi `busy`. |
| **H3** | `QuanLySmartContractPage.tsx` | commit/reveal/finalize: `toast.error(getErrorMessage)` khi lỗi, `toast.success` khi xong (react-hot-toast đã mount sẵn) ⇒ lỗi tx/bảo mật S4/S5 không còn bị chôn. |
| **M1+M4** | `QuetMaQRPage.tsx` | Helper `readableError` lấy message backend ⇒ lockout OTP "Còn N lần thử" (S2) & lỗi xác thực mã mời tới được người dùng (trước đây nuốt/`err.message` thô). |
| **M2+L5** | `ModalOTP.tsx` | `role="dialog"` `aria-modal` `aria-labelledby` + Escape đóng + autofocus title id; padding `p-6 sm:p-8` (mobile). |
| **M5+L2** | `CuocBauCuCuaNguoiDungPage.tsx` | Hint "chưa có ví MetaMask"; `aria-label="Tìm ballot"` cho ô search. |
| **M6+L4** | `QuanLySmartContractPage.tsx` | `YesNoBadge` (icon CheckCircle2/XCircle + nhãn + `aria-label`, không chỉ màu) cho Đủ điều kiện/Đã commit/Đã reveal; Việt hoá nhãn; `formatUnix` "n/a"→"Chưa thiết lập". |

## Verify

- Scoped typecheck (4 file đụng + import): **0 lỗi do thay đổi**. Lỗi duy nhất trong file là `QuanLySmartContractPage:877 {currentPositionTitle}` — pre-existing từ Đợt 1 (chỉ đổi số dòng), không phải UX change. 15 lỗi khác = nợ type legacy có sẵn (apiClient `import.meta.env`, store slices) ngoài scope.
- Active jest: **8/8 pass** (reachable code nguyên vẹn).
- Không thêm dependency (tái dùng `react-hot-toast` + `lucide-react` đã có); không đụng legacy.

## Follow-up (ghi nhận trung thực — không làm để giữ surgical/low-risk)

- **H4**: banner "MetaMask chưa cài" với link tải — hiện lỗi đã hiển thị qua toast+message (đủ tối thiểu); banner CTA chuyên dụng là polish.
- **M3/M7**: `QuetMaQRPage` còn dùng Radix Toast cục bộ + theme gray (không clay) — visual refactor lớn hơn, rủi ro hơn, tách follow-up.
- **L1/L3**: localize toàn bộ heading kỹ thuật ("Action rail"/"Viewer state"…) & dời cảnh báo vote-secret S4 ra vị trí to/đúng lúc — polish rộng.
- Full `tsc`/`vite build` xác nhận bundle vẫn cần Node LTS (Đợt 4/S19, host đang Node 25).
