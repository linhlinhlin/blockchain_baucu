# Feature Specification: Đợt 12 — Re-theme 2 trang pháp lý dark→light (clay)

**Branch**: `012-legal-light-retheme` · **Created**: 2026-05-19 · **Status**: Draft
**Input**: Hoàn tất follow-up Đợt 11: chuyển `ChinhSachBaoMatPage` & `DieuKhoanSuDungPage` từ dark bespoke sang hệ sáng clay, GIỮ framer-motion/ToC/scroll/back-to-top, không tăng chiều cao cuộn. Nguồn: `docs/audit/REMEDIATION_DOT11.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Trang pháp lý đồng bộ hệ sáng (Priority: P1)

Người đọc Chính sách bảo mật / Điều khoản sử dụng thấy trang theo đúng hệ Apple-like sáng + accent xanh (giống mọi trang khác sau Đợt 10/11), không còn nền tối bespoke lạc tông; mục lục dính, nút về đầu trang, hiệu ứng cuộn vẫn hoạt động y như cũ.

**Why P1**: Đây là 2 trang công khai cuối còn lạc tông (dark) so với toàn hệ sáng — phá nhất quán thương hiệu.

**Independent Test**: Mở 2 trang: màu nền/chữ theo token clay sáng, chữ tương phản đọc được; cuộn → ToC dính + back-to-top + animation hoạt động; chiều cao cuộn không tăng so với trước.

**Acceptance Scenarios**:
1. **Given** trang pháp lý, **When** tải, **Then** nền sáng (clay), chữ tối tương phản ≥ AA, accent xanh clay; không còn hex dark bespoke.
2. **Given** cuộn trang, **When** lăn xuống/lên, **Then** framer-motion parallax + ToC dính + back-to-top vẫn chạy; không lỗi.
3. **Given** đo runtime 1440×900, **When** so trước/sau, **Then** `scrollHeight` không tăng.

### Edge Cases
- Hex màu xuất hiện trong cả bg lẫn text: ánh xạ theo ngữ nghĩa (bg-dark→light surface, text-light→dark text) để giữ tương phản.
- Class gradient `bg-gradient-to-*`: đã bị guardrail Đợt 7 trung hoà — stop-color để lại vô hại.

## Requirements *(mandatory)*

- **FR-001**: 2 trang pháp lý PHẢI dùng token clay sáng cho nền/chữ/viền/accent; loại bỏ hex dark bespoke (#0A1416/#1A2327/#1E272C/#263238/#37474F/#455A64/#B0BEC5) và off-system Tailwind (gray/blue/amber/green/purple-*).
- **FR-002**: GIỮ NGUYÊN framer-motion (`useScroll/useTransform/motion.*`), ToC dính, back-to-top, `scrollIntoView/scrollTo` — chỉ đổi chuỗi màu, không đổi cấu trúc/logic.
- **FR-003**: Tương phản văn bản ≥ WCAG AA trên nền sáng (ánh xạ ngữ nghĩa: hex-nền-tối→surface sáng, hex-chữ-sáng→chữ tối).
- **FR-004**: `scrollHeight` KHÔNG tăng (chỉ thay class màu, 0 thay đổi cấu trúc DOM).
- **FR-005**: Thay đổi tối thiểu (replace_all chuỗi màu); không thêm lib; không đụng BE/Redux/route/legacy/`src/test`; không secret.
- **FR-006**: Quality gate: `npm run typecheck:active` = 0 (2 trang đã trong include từ Đợt 11).

## Success Criteria *(mandatory)*

- **SC-001**: `grep` 2 file: 0 hex dark bespoke + 0 `(bg|text|border)-(gray|blue|amber|green|purple)-NNN` ad-hoc còn lại (chứng cứ).
- **SC-002**: framer-motion/ToC/scroll refs giữ nguyên số lượng (diff không đụng các dòng đó).
- **SC-003**: `npm run typecheck:active` = 0; 0 secret/legacy/lib mới; BE 0 đụng.
- **SC-004**: `scrollHeight` 1440×900 không tăng (phân tích tĩnh: chỉ đổi chuỗi class màu ⇒ DOM bất biến; xác nhận runtime = người dùng).

## Assumptions
- Kế thừa Đợt 10/11: Apple-like sáng, light-only, accent xanh clay.
- Bản đồ token cố định (research.md). framer-motion/ToC/scroll không chứa hex ⇒ replace_all chuỗi màu không chạm logic.
- Nghiệm thu px runtime cần Node 20/22 + browser (người dùng).

## Out of Scope
- Đổi nội dung pháp lý, cấu trúc DOM, animation timing.
- Trang/route khác (đã xong Đợt 10/11).
