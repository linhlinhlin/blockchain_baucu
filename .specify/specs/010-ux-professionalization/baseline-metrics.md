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

## SC measurements (điền ở T042)
- SC-002 toast: _(grep result)_
- SC-003 shared components: _(grep result)_
- SC-005 a11y: _(checklist)_
- SC-006 gates: _(tsc/secret/legacy)_
- SC-007 kịch bản tạo bầu cử: _(quan sát)_
