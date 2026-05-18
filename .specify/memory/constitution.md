# HoLiHu Blockchain Election — Constitution

Hệ thống bầu cử (sinh viên) on-chain. Giá trị cốt lõi: **đúng quy trình, dễ kiểm toán, dễ vận hành** — không phô diễn công nghệ. Mọi spec/plan/tasks phải tuân thủ hiến chương này.

## Core Principles

### I. Security & Integrity First (NON-NEGOTIABLE)
Tính toàn vẹn của lá phiếu là bất khả xâm phạm. Không bao giờ commit secret (private key, JWT secret, OTP, mật khẩu) vào repo. Bí mật runtime đi qua env/secret store, không qua source hay client. OTP/định danh phải chống brute-force (rate-limit + lockout) và lưu dạng hash. Vote-secret (salt/commitment) không lưu plaintext nơi XSS chạm tới. Mọi HTML từ dữ liệu người dùng phải được sanitize. Một phát hiện Critical mở là blocker phát hành.

### II. Auditability
Mọi thay đổi ảnh hưởng bầu cử phải truy vết được: spec → plan → tasks → commit, và trỏ tới `file:line`. On-chain chỉ giữ phần thực sự cần kiểm chứng (eligibility, commit-reveal, finalize). Hành vi nhạy cảm (deploy, finalize, bind ví) phải có log/sự kiện. Báo cáo audit (`docs/audit/`) là input bắt buộc cho mọi đợt remediation.

### III. Simplicity / Legacy Freeze
Theo YAGNI. Stack account-abstraction cũ (EntryPoint, HLUPaymaster, HoLiHuToken, SimpleAccount, session-key server-side, geth private chain) bị **ĐÓNG BĂNG** — không mở rộng, chỉ xóa hoặc cô lập vào `legacy/`. Baseline active là `ElectionFactoryV1`/`ElectionV1` + ASP.NET Core + React/Vite + PostgreSQL + Sepolia/Anvil. Code không thuộc active path phải được gỡ khỏi build/bundle, không "để đó cho chắc".

### IV. Spec-Driven & Surgical Change
Tính năng/đợt sửa lớn (≥3 surface, ≥2 người, hoặc đụng bảo mật) phải đi qua pipeline Spec-Kit. Thay đổi tối thiểu, đúng trọng tâm; không refactor cơ hội ngoài scope spec. Mỗi task có bước verify cụ thể (lệnh/test), không "done" mơ hồ.

### V. Reproducibility
Một thành viên mới phải dựng được hệ thống từ fresh clone chỉ bằng tài liệu trong repo. Prereq ngoài (Sepolia ETH, RPC, SMTP) phải được tài liệu hoá rõ. Toolchain pin về phiên bản hỗ trợ (Node LTS 20/22; .NET hiện tại `net9.0`; Foundry là chuẩn test contract). Docs phải đúng path/framework thực tế của repo, không trỏ path cũ.

## Security Baseline

- Không secret trong git. `.env`, `appsettings.*.json` bí mật phải gitignored; ship file `*.example`.
- AuthN/Z: JWT secret bắt buộc cấu hình (không có hằng số fallback); endpoint nhạy cảm có rate-limit.
- Định danh cử tri: ràng buộc đủ mạnh (không coi field trống là khớp); invite gắn với account ở bước OTP.
- Smart contract: commit-reveal domain-separated, Merkle eligibility chuẩn OZ v5, chặn double-commit/reveal/replay/reentrancy; `finalize` có ngưỡng turnout hoặc cờ low-turnout tường minh.
- Bí mật/key đã từng lộ trong git history phải coi như **đã compromise** và rotate.

## Development Workflow

- Báo cáo audit cập nhật trước khi mở đợt remediation; spec tham chiếu mã issue (vd `S1`, `S2`).
- Mỗi spec atomic (một nhóm vấn đề đóng gói), ≤5 trang; out-of-scope ghi rõ.
- Quality gate trước merge: contracts `npm run compile` + Hardhat test pass; backend `dotnet build` 0 error; frontend `tsc --noEmit` sạch ở active path; không secret mới; không tăng bề mặt legacy.
- Commit sau mỗi task/nhóm logic; PR description link `spec.md` + `plan.md`.

## Governance

Hiến chương này đứng trên mọi thói quen khác. Sửa đổi phải ghi lý do, tăng version, và cập nhật ngày. Mọi PR/review phải kiểm tra tuân thủ; vi phạm Principle I là blocker tuyệt đối. Độ phức tạp thêm vào phải được biện minh trong `plan.md`. Quyết định scope từng đợt chốt cùng team trước khi `/speckit-implement`.

**Version**: 1.0.0 | **Ratified**: 2026-05-18 | **Last Amended**: 2026-05-18
