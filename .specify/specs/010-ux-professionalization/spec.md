# Feature Specification: Đợt 10 — Chuyên nghiệp hoá toàn diện UX/UI ứng dụng

**Feature Branch**: `010-ux-professionalization`
**Created**: 2026-05-19
**Status**: Draft
**Input**: Nâng cấp hệ thiết kế Apple-like sáng hiện có cho nhất quán & chuẩn các tổ chức lớn (Coursera/YouTube/blockchain). Diệt "địa ngục cuộn", chuẩn hoá điều hướng & bộ component dùng chung, làm lại lần lượt 5 trang app. Tham chiếu nguồn sự thật: `docs/audit/AUDIT_2026-05-18.md`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Khung ứng dụng & điều hướng nhất quán (Priority: P1)

Người vận hành bầu cử đăng nhập và luôn biết mình đang ở đâu, đi đâu tiếp: thanh điều hướng phân cấp rõ ràng, có trạng thái mục đang chọn, có đường dẫn phân cấp (breadcrumb) ở mọi trang, và trên di động mở/đóng được bằng ngăn kéo với vùng chạm đủ lớn. Khung trang ổn định, không nhồi nội dung khiến phải cuộn ngay từ vỏ ứng dụng.

**Why this priority**: Đây là nền tảng. Mọi trang sống trong khung này; sửa khung trước thì 5 trang sau kế thừa được sự nhất quán mà không làm lại nhiều lần.

**Independent Test**: Đăng nhập, duyệt qua cả 5 trang app: mỗi trang hiển thị breadcrumb đúng, mục điều hướng tương ứng được đánh dấu active; thu nhỏ về khổ điện thoại thì điều hướng chuyển sang ngăn kéo đóng/mở được, mọi nút chạm ≥44px. Không có chức năng nghiệp vụ nào bị mất.

**Acceptance Scenarios**:

1. **Given** người dùng đã đăng nhập ở bất kỳ trang app nào, **When** quan sát đầu vùng nội dung, **Then** thấy breadcrumb phản ánh đúng vị trí và mục điều hướng hiện tại được tô trạng thái active.
2. **Given** màn hình rộng < 768px, **When** mở điều hướng, **Then** ngăn kéo trượt ra, phủ nền mờ, đóng được bằng nút đóng / chạm nền / phím Esc; mọi mục chạm được dễ dàng.
3. **Given** người dùng dùng bàn phím, **When** Tab qua điều hướng, **Then** có vòng focus thấy rõ và thứ tự tiêu điểm hợp lý; có liên kết "bỏ qua tới nội dung".

---

### User Story 2 - Hệ thiết kế & bộ component dùng chung thống nhất (Priority: P1)

Toàn bộ ứng dụng dùng một bộ token thị giác (màu/chữ/khoảng cách/bo góc/độ nổi) và một bộ component cấp cao dùng chung: nút, ô nhập, thẻ, nhãn trạng thái, menu thả xuống có style, tab, bước (stepper), bảng dữ liệu (sắp xếp/lọc/phân trang), phân trang, breadcrumb, trạng thái rỗng, trạng thái tải (skeleton/spinner), và **một** hệ thông báo (toast) duy nhất.

**Why this priority**: Không có bộ dùng chung thống nhất thì mỗi trang lại "tự chế" → loạn. Đây là điều kiện để 5 trang sau đạt chuẩn nhất quán mà không lặp lại công sức.

**Independent Test**: Mở bảng trình diễn nội bộ (hoặc rà soát từng trang): mọi nút/ô nhập/thẻ/menu/nhãn trông và hành xử nhất quán; chỉ còn một loại thông báo toast xuất hiện trong toàn bộ luồng active; không còn lớp giao diện trùng lặp tự chế trong các trang active.

**Acceptance Scenarios**:

1. **Given** bất kỳ hành động thành công/lỗi nào (tạo bầu cử, commit/reveal, xác minh), **When** hệ thống phản hồi, **Then** chỉ một kiểu thông báo toast nhất quán xuất hiện (vị trí, kiểu dáng, thời lượng đồng nhất).
2. **Given** một thao tác cần chờ on-chain/máy chủ, **When** đang xử lý, **Then** hiển thị trạng thái tải nhất quán (skeleton hoặc spinner kèm nhãn), không "đứng hình" không phản hồi.
3. **Given** một danh sách không có dữ liệu, **When** trang tải xong, **Then** hiển thị trạng thái rỗng có hướng dẫn hành động kế tiếp, không phải vùng trắng trống trơn.

---

### User Story 3 - Trang "Tạo bầu cử" hết "địa ngục cuộn" (Priority: P1)

Người tạo bầu cử hoàn tất việc thiết lập (thông tin chung → vị trí → ứng viên → danh sách cử tri → triển khai) theo một luồng có cấu trúc (các bước/section điều hướng được), với khu tóm tắt cố định luôn thấy tiến độ và hành động chính, thay vì một trang dài phải cuộn liên tục.

**Why this priority**: Đây là trang nặng và "phản người dùng" nhất theo phản ánh; cải thiện ở đây mang lại giá trị thấy rõ nhất cho tác vụ cốt lõi của hệ thống.

**Independent Test**: Tạo một bầu cử đầy đủ từ đầu đến triển khai: tác vụ của từng bước nằm trong tầm nhìn không phải cuộn dài; khu tóm tắt/hành động chính luôn truy cập được; kết quả on-chain (commit-reveal/finalize) tạo ra giống hệt trước về mặt dữ liệu.

**Acceptance Scenarios**:

1. **Given** màn hình 1440×900, **When** vào trang Tạo bầu cử, **Then** hành động chính và điều hướng giữa các bước thấy được mà không cần cuộn; chuyển bước không làm mất dữ liệu đã nhập.
2. **Given** danh sách cử tri rất dài, **When** xem/sửa danh sách, **Then** danh sách nằm trong vùng có kiểm soát chiều cao (cuộn nội bộ/phân trang) chứ không kéo dài vô tận cả trang.
3. **Given** đã nhập thiếu trường bắt buộc ở một bước, **When** thử triển khai, **Then** hệ thống chỉ rõ bước/trường lỗi và đưa người dùng tới đó, không cho triển khai dữ liệu thiếu.

---

### User Story 4 - Bảng điều khiển Smart Contract gọn & đọc được (Priority: P2)

Người quản trị theo dõi và điều khiển vòng đời on-chain (commit / reveal / finalize) qua một bảng điều khiển được tổ chức theo tab/section và bảng dữ liệu có sắp xếp–lọc, thay vì một trang ~1000 dòng cuộn dọc bất tận.

**Why this priority**: Trang nặng thứ hai, ảnh hưởng trực tiếp tới vận hành kỳ bầu cử; nhưng phụ thuộc nền tảng (US1/US2) nên xếp sau P1.

**Independent Test**: Mở bảng điều khiển một kỳ bầu cử đang chạy: trạng thái pha hiện rõ; thao tác commit/reveal/finalize đặt ở nơi dễ thấy theo ngữ cảnh pha; bảng kết quả/cử tri sắp xếp–lọc–phân trang được; thực hiện một chu trình pha cho kết quả on-chain đúng như trước.

**Acceptance Scenarios**:

1. **Given** một kỳ bầu cử ở pha bất kỳ, **When** mở bảng điều khiển, **Then** pha hiện tại và hành động hợp lệ kế tiếp được làm nổi bật; hành động không hợp lệ với pha bị vô hiệu hoá có giải thích.
2. **Given** bảng kết quả nhiều dòng, **When** sắp xếp/lọc/chuyển trang, **Then** bảng phản hồi đúng và không buộc cuộn toàn trang.

---

### User Story 5 - Danh sách bầu cử dạng bảng/lưới chuyên nghiệp (Priority: P2)

Người dùng tìm và mở kỳ bầu cử qua danh sách có tìm kiếm, lọc theo trạng thái/pha, phân trang và trạng thái rỗng rõ ràng — không phải cuộn qua một danh sách thô dài.

**Why this priority**: Điểm vào thường dùng; cải thiện tìm–lọc giảm ma sát nhưng không nặng bằng hai trang P1/P2 trên.

**Acceptance Scenarios**:

1. **Given** nhiều kỳ bầu cử, **When** gõ từ khoá hoặc chọn bộ lọc, **Then** danh sách thu hẹp tức thì và phân trang đúng.
2. **Given** không có kết quả khớp, **When** lọc xong, **Then** hiển thị trạng thái rỗng có gợi ý (xoá lọc/tạo mới).

---

### User Story 6 - Xác minh cử tri & Quét QR theo luồng rõ ràng (Priority: P3)

Cử tri đi qua xác minh danh tính theo các bước tuần tự rõ ràng (nhập email → mã OTP → gắn ví) và trang quét QR có bố cục gọn, phản hồi trạng thái rõ — không lộ bí mật, không hồi quy bảo mật.

**Why this priority**: Hai trang ngắn hơn, ít "scroll hell"; hoàn thiện sau cùng để đồng bộ tổng thể.

**Acceptance Scenarios**:

1. **Given** cử tri đang xác minh, **When** đi qua từng bước, **Then** chỉ thấy bước hiện tại + tiến độ; lỗi từng bước hiển thị tại chỗ; OTP/bí mật không bị echo hay lưu nơi script chạm tới.
2. **Given** trang quét QR, **When** quét/nhập mã, **Then** trạng thái (đang quét/thành công/lỗi) phản hồi rõ bằng component dùng chung.

---

### Edge Cases

- Danh sách cử tri/kết quả rất lớn: vùng dữ liệu phải cuộn nội bộ hoặc phân trang, không làm trang phình chiều cao.
- Chờ on-chain/máy chủ lâu hoặc lỗi mạng: hiển thị trạng thái tải và lỗi nhất quán, có hành động thử lại; không khoá cứng giao diện.
- Không có dữ liệu (chưa có bầu cử/cử tri/kết quả): trạng thái rỗng có hướng dẫn, không vùng trắng.
- Màn hình rất nhỏ và rất rộng: bố cục co giãn hợp lý; điều hướng dạng ngăn kéo trên di động.
- Bàn phím/đọc màn hình: mọi điều khiển tới được bằng Tab, có nhãn, có vòng focus, đóng overlay bằng Esc.
- Mất kết nối ví/sai mạng (không phải Sepolia): thông báo rõ ràng theo mẫu lỗi chung, không sập trang.
- Chuyển bước/tab khi đang nhập dở: dữ liệu không bị mất.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống PHẢI cung cấp khung ứng dụng nhất quán cho mọi trang sau đăng nhập: điều hướng phân cấp có trạng thái active, breadcrumb ở mọi trang, và vùng nội dung không bị nhồi gây cuộn ở mức vỏ.
- **FR-002**: Điều hướng PHẢI đáp ứng di động: dưới ngưỡng màn hình hẹp chuyển sang ngăn kéo đóng/mở được (nút đóng, chạm nền, phím Esc); mọi mục tương tác có vùng chạm ≥ 44×44px.
- **FR-003**: Hệ thống PHẢI dùng một bộ token thị giác chung (màu, chữ, khoảng cách, bo góc, độ nổi) trên toàn bộ trang active; không trang nào tự định nghĩa lại token thị giác riêng.
- **FR-004**: Mọi nút, ô nhập, thẻ, nhãn trạng thái, menu thả xuống, tab, bước, bảng dữ liệu, phân trang, breadcrumb trong các trang active PHẢI dùng component dùng chung thống nhất; loại bỏ lớp giao diện trùng lặp tự chế ở trang active.
- **FR-005**: Hệ thống PHẢI hợp nhất về **một** cơ chế thông báo (toast) duy nhất; mọi phản hồi thành công/cảnh báo/lỗi trong luồng active đi qua cơ chế đó với vị trí/kiểu dáng/thời lượng nhất quán.
- **FR-006**: Hệ thống PHẢI cung cấp trạng thái tải nhất quán (skeleton/spinner kèm nhãn) cho mọi thao tác chờ on-chain hoặc máy chủ, và trạng thái rỗng có hướng dẫn cho mọi danh sách không có dữ liệu.
- **FR-007**: Trang "Tạo bầu cử" PHẢI được tổ chức lại thành luồng có cấu trúc (các bước/section điều hướng được) với khu tóm tắt/hành động chính luôn truy cập được; tác vụ của bước hiện tại nằm trong tầm nhìn ở màn hình 1440×900 mà không cần cuộn dài.
- **FR-008**: Các vùng danh sách dài (cử tri, kết quả) PHẢI có chiều cao được kiểm soát bằng cuộn nội bộ hoặc phân trang, không kéo dài chiều cao toàn trang vô hạn.
- **FR-009**: Bảng điều khiển Smart Contract PHẢI được tổ chức theo tab/section với trạng thái pha nổi bật và hành động hợp lệ theo ngữ cảnh pha; hành động không hợp lệ với pha bị vô hiệu hoá kèm giải thích.
- **FR-010**: Danh sách bầu cử PHẢI hỗ trợ tìm kiếm, lọc theo trạng thái/pha và phân trang, kèm trạng thái rỗng có gợi ý hành động.
- **FR-011**: Luồng xác minh cử tri PHẢI trình bày theo các bước tuần tự rõ ràng với lỗi tại chỗ; trang quét QR có bố cục gọn và phản hồi trạng thái bằng component dùng chung.
- **FR-012**: Hệ thống PHẢI giữ nguyên mọi chức năng nghiệp vụ hiện có (tạo bầu cử, commit/reveal/finalize trên Sepolia, xác minh cử tri, quét QR) — không hồi quy hành vi hay dữ liệu on-chain; chỉ thay đổi trình bày/UX.
- **FR-013**: Mọi điều khiển PHẢI truy cập được bằng bàn phím, có nhãn cho trình đọc màn hình, có vòng focus thấy rõ, có liên kết bỏ qua tới nội dung; văn bản đạt tương phản tối thiểu mức AA.
- **FR-014**: Thay đổi PHẢI tối thiểu đúng scope và ưu tiên tái dùng component sẵn có; chỉ sửa máy chủ khi UX bị chặn (ví dụ phân trang/tìm kiếm/định dạng phản hồi) và KHÔNG thay đổi hợp đồng on-chain.
- **FR-015**: Thay đổi PHẢI tuân thủ Hiến chương — Principle I (Security & Integrity First) là blocker tuyệt đối: không commit secret, không làm yếu commit-reveal/xử lý bí mật, không lộ OTP/vote-secret nơi script chạm tới, không mở rộng bề mặt legacy, không đụng `frontend/src/test/**` legacy.

### Key Surfaces (phạm vi giao diện, không phải mô hình dữ liệu)

- **Khung ứng dụng**: vỏ sau đăng nhập + thanh điều hướng + breadcrumb.
- **Bộ component dùng chung**: nút, ô nhập, thẻ, nhãn trạng thái, menu thả xuống, tab, bước, bảng dữ liệu, phân trang, breadcrumb, trạng thái rỗng, trạng thái tải, một hệ toast.
- **5 trang app active**: Tạo bầu cử; Bảng điều khiển Smart Contract; Danh sách bầu cử; Xác minh cử tri; Quét QR.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Trên màn hình 1440×900, hành động chính và điều hướng bước/section của trang "Tạo bầu cử" và "Bảng điều khiển Smart Contract" thấy được mà KHÔNG cần cuộn; chiều cao cuộn tối đa của mỗi trang này giảm ≥ 40% so với hiện trạng.
- **SC-002**: Toàn ứng dụng chỉ còn **một** hệ thông báo toast được sử dụng trong luồng active (các hệ toast còn lại không còn được gọi ở trang active).
- **SC-003**: 100% trang app active dùng component dùng chung cho nút/ô nhập/thẻ/menu/nhãn/bảng; không còn lớp giao diện tự chế trùng lặp ở trang active (rà soát có chứng cứ `file:line`).
- **SC-004**: 5 luồng nghiệp vụ chính chạy hết không hồi quy: tạo bầu cử → triển khai; commit → reveal → finalize trên Sepolia; xác minh cử tri; quét QR; danh sách/lọc. Kết quả/dữ liệu on-chain giống trước.
- **SC-005**: Mọi điều khiển trong trang active thao tác được hoàn toàn bằng bàn phím, có vòng focus thấy rõ; văn bản đạt tương phản ≥ WCAG AA; vùng chạm điều hướng di động ≥ 44px.
- **SC-006**: Quality gate xanh: `tsc --noEmit` sạch ở active path; `dotnet build` 0 error nếu có đụng máy chủ; không secret mới; không tăng bề mặt legacy.
- **SC-007**: Người dùng hoàn tất tạo một bầu cử mẫu (1 vị trí, 2 ứng viên, 3 cử tri) qua luồng mới với số lần cuộn giảm rõ rệt và không bị lạc bước (kiểm thử thao tác có kịch bản).

## Assumptions

- Giữ ngôn ngữ thị giác Apple-like sáng + một accent xanh hiện có; KHÔNG đổi thương hiệu, KHÔNG thêm dark mode (light-only theo quy ước Đợt 7).
- Ưu tiên tái dùng bộ primitive UI sẵn có trong dự án; không thêm thư viện UI mới trừ khi thật sự cần và đã biện minh trong `plan.md`.
- Triển khai theo thứ tự: (1) khung + điều hướng + token + bộ component dùng chung; (2) lần lượt 5 trang, ưu tiên "Tạo bầu cử" rồi "Bảng điều khiển Smart Contract". Mỗi mục P độc lập kiểm thử và bàn giao được.
- Máy chủ (ASP.NET Core net9.0, API `/api/election-v1/*`) chỉ sửa tối thiểu khi UX bị chặn (phân trang/tìm kiếm/định dạng phản hồi); không đổi hợp đồng/sự kiện on-chain.
- Nguồn sự thật trạng thái hệ thống: `docs/audit/AUDIT_2026-05-18.md`. Tài liệu lỗi thời (`SYSTEM_MODERNIZATION_REVIEW_2026-04-10.md`) không dùng làm căn cứ.
- `frontend/src/test/**` là legacy chưa xoá — ngoài phạm vi, không đụng tới.

## Out of Scope

- Đổi thương hiệu/đổi hệ màu, thêm dark mode, hay đổi ngôn ngữ thiết kế nền tảng.
- Các trang công khai/marketing (landing, login, register, FAQ, liên hệ, danh sách công khai) — đợt sau, không thuộc Đợt 10.
- Thay đổi hợp đồng thông minh hay logic commit-reveal/finalize on-chain.
- Tính năng nghiệp vụ mới; chỉ tổ chức lại trình bày/UX của chức năng hiện có.
- Dọn dẹp/di trú legacy ngoài việc không mở rộng bề mặt (thuộc các spec 003/005).
