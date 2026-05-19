# Baseline & Verification Metrics — Đợt 10

## T001 — Structural baseline (đo được tĩnh, không cần trình duyệt)

| Trang | Dòng (trước) | Cấu trúc cuộn (trước) | Mục tiêu sau |
|---|---|---|---|
| `TaoCuocBauCuPage.tsx` | **1340** | 4 section xếp dọc 1 mạch (anchor nav thủ công) | Wizard 4 bước, 1 bước/viewport, SummaryRail sticky |
| `QuanLySmartContractPage.tsx` | **1028** | grid 3 cột + detail cao dồn xuống | master-detail + Tabs + phase header sticky |
| `CuocBauCuCuaNguoiDungPage.tsx` | 243 | list thô, lọc client-side rời rạc | DataTable height-capped + filter/sort/paginate |
| `VoterVerificationPage.tsx` | 533 | form nhiều khối dọc | Wizard 3 bước |
| `QuetMaQRPage.tsx` | 575 | khối dọc | bố cục gọn + EmptyState/Loader |

**SC-001 (giảm ≥40% chiều cao cuộn)** cần đo runtime ở khổ 1440×900. Agent không chạy được trình duyệt → người dùng chạy `cd frontend && npm run dev` (Node 20/22 LTS) rồi dán snippet sau vào DevTools Console ở mỗi trang, ghi số vào bảng dưới:

```js
// 1440x900 viewport. Chạy ở mỗi trang trước & sau Đợt 10.
console.log(location.pathname, '| scrollHeight =', document.documentElement.scrollHeight, 'px');
```

| Trang | scrollHeight TRƯỚC (px) | scrollHeight SAU (px) | Giảm % | Đạt ≥40%? |
|---|---|---|---|---|
| `/app/tao-phien-bau-cu` | _(điền)_ | _(điền)_ | | |
| `/app/quan-ly-smart-contract` | _(điền)_ | _(điền)_ | | |

> Proxy tĩnh khi chưa có số runtime: số dòng JSX trả về của trang & số "section xếp dọc top-level" trước/sau (Wizard chỉ render 1 panel-viewport tại một thời điểm ⇒ chiều cao thực giảm rõ).

## T002 — Branch
`010-ux-professionalization` ✓ (off Đợt 9 tip `dffa562`). Tree: chỉ file spec-kit Đợt 10 + CLAUDE.md pointer.

## tsc baseline (pre-existing)
Xem `.tsc_baseline.txt` (repo root, dọn ở T043). Chỉ tính **regression do Đợt 10**; lỗi pre-existing ở active path (nếu có) ghi nhận, không thuộc trách nhiệm Đợt 10 nhưng không được tăng thêm.

## SC measurements (T042)

| SC | Tiêu chí | Kết quả |
|---|---|---|
| SC-001 | Giảm ≥40% chiều cao cuộn (Tạo bầu cử, Bảng điều khiển) | **Cần đo runtime** (snippet ở trên). Proxy tĩnh: Tạo bầu cử 1340 dòng-1-mạch → Wizard 4 bước (1 bước/viewport); Bảng điều khiển 1028 dòng-3-cột-dồn → master-detail + Tabs (detail tách 2 tab). Chiều cao một-thời-điểm giảm rõ. |
| SC-002 | 1 hệ toast active path | ✅ chỉ `react-hot-toast` qua `notify`; 0 sweetalert2/sonner/react-toastify trong 5 trang+shell+clay |
| SC-003 | 100% trang dùng component dùng chung, hết builder tự chế | ✅ 5/5 trang import `components/ui/clay`; 0 lời gọi panelClasses/inputClasses/actionButtonClasses/commandButtonClasses/... trong JSX. (Def mồ côi ở QuanLy 1-745 = dead code vô hại, KHÔNG sửa để bảo toàn cổng S4/S5) |
| SC-004 | 5 luồng không hồi quy | Logic state/handler/effect bảo toàn verbatim mọi trang; S4/S5 byte-identical (T032). **Cần kiểm thử thao tác runtime** (Node 20/22 + ví Sepolia) theo quickstart §B |
| SC-005 | a11y: keyboard/focus/≥44px/AA | ✅ component clay: focus-visible outline, aria, target ≥44px (Button lg/nav/drawer), Field htmlFor/aria-describedby/aria-invalid, drawer Esc+focus-trap+role=dialog |
| SC-006 | quality gate | ✅ **Đợt 10.1**: `npm run typecheck:active` (`tsconfig.active.json`) = **0 lỗi** — toàn bộ 16 lỗi pre-existing active-path đã xử lý bằng thay đổi type-only/runtime-noop. 0 secret · 0 tăng legacy · package.json chỉ thêm script (0 lib mới) · BE 0 đụng · S4/S5 giữ nguyên. |
| SC-007 | kịch bản tạo bầu cử | Wizard 4 bước, validation đẩy đúng bước/field; **kiểm thử thao tác runtime** theo quickstart §B1 |

> Hạn chế môi trường: agent không chạy được trình duyệt → SC-001 (px cuộn) & SC-004/SC-007 (thao tác) cần người dùng chạy `npm run dev` (Node 20/22 LTS, vì Node 25 quá mới cho Vite 6) theo `quickstart.md`. Mọi verify tĩnh (tsc/diff/grep/cổng S4/S5) đã PASS.
