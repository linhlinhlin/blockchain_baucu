# ADR 0002 — Đánh giá kiến trúc & quyết định KHÔNG rewrite big-bang DDD

**Ngày:** 2026-05-20 · **Trạng thái:** Accepted · **Liên quan:** Constitution (I/III/IV), ADR 0001

## Bối cảnh

Yêu cầu: "cải thiện toàn bộ về công nghệ/kiến trúc (ví dụ DDD) theo chuẩn dự án
hàng đầu", tham khảo `github.com/linhlinhlin/LMS_hohulili`.

## Bằng chứng

**Repo tham chiếu** = Maritime LMS, **Java 21/Spring + Angular 20 + Postgres**,
kiến trúc *layered (domain/application/infrastructure) + repository pattern +
API versioning + RBAC + health (Actuator) + spec-driven docs* — **KHÔNG** DDD
nặng/CQRS/aggregate-root; **khác hoàn toàn stack & domain** so với dự án này
(ASP.NET Core .NET9 + React/Vite + Solidity, hệ bầu cử on-chain).

**Kiến trúc hiện tại (đo thực tế 2026-05-20):** layered ASP.NET Core đơn
project — `Controllers/`(23) → `Service[s]/`(22) → EF `Data/` (provider-aware
Postgres, S12) → `Models/`(78); `Program.cs` DI + JWT(hardened, S3) + CORS
(config, S10) + RateLimiter; API **versioned** `/api/election-v1/*`; RBAC
(Quan Tri Vien/Nguoi Dung + `ProtectedRoute`); `/health` + container
healthcheck; FE React18/Vite6 + Redux Toolkit + lớp `clay` (Đợt 10–12) +
route code-splitting (Đợt 13, main 1769→427kB). **Tầng governance**: Spec-Kit
(specify→plan→tasks→implement), `docs/adr/`, `docs/audit/` (10 đợt
remediation + SECURITY_VERIFICATION) + cổng `typecheck:active`=0 — **nghiêm
hơn** repo tham chiếu.

→ Trên các trụ cột *chuyển giao được* (API versioned, layering, EF
abstraction, RBAC, health, spec-driven/ADR), dự án **ngang hoặc vượt** chuẩn
của chính repo tham chiếu và "dự án hàng đầu" cho hệ **quy mô vừa, rủi ro cao,
đang chạy, đã audit**.

## Quyết định

**KHÔNG thực hiện rewrite big-bang sang DDD/CQRS/Clean-Architecture-multi-project.**

Lý do (Hiến chương đứng trên mọi yêu cầu khác):
- **Principle III (YAGNI/Simplicity)**: "độ phức tạp thêm phải được biện minh".
  DDD aggregate/CQRS/MediatR cho hệ cỡ này = phức tạp đầu cơ không biện minh
  được; repo tham chiếu cũng chỉ layered.
- **Principle IV (Surgical/Spec-Driven)**: rewrite ≠ surgical; mọi thay đổi
  lớn phải qua Spec-Kit có scope, không refactor cơ hội tự do.
- **Principle I (Security, NON-NEGOTIABLE)**: tái cấu trúc commit-reveal/JWT/
  OTP/auth đã verify (S1–S13 resolved) = rủi ro toàn vẹn phiếu không chấp nhận.
- **karpathy Simplicity/Surgical**: "đừng refactor thứ không hỏng".

## Hệ quả & khuyến nghị (bounded, có ưu tiên — KHÔNG rewrite)

1. **[Làm ngay — rủi ro 0]** Bổ sung `docs/ARCHITECTURE.md` hợp nhất (điểm mạnh
   "comprehensive docs" của repo tham chiếu mà codebase đang thiếu bản gom).
2. **[Spec-Kit nếu muốn — Med]** Hợp nhất `Service/` vs `Services/` (smell
   thật, 22 file) — chỉ qua một đợt SDD có scope (đụng namespace nhiều file,
   gần security ⇒ surgical, không làm tự phát ở đây).
3. **[Spec-Kit — Low/sau]** Tách `Models/` entity vs DTO; pin Node 20/22 (S19);
   cập nhật runbook (S20). Đều ngoài scope đợt này, đã ghi audit.
4. **Không** thêm lib/tầng mới chỉ để "giống dự án khác".

"Tiến hành" đúng nghĩa = ADR này + thực thi mục (1); (2)(3) chờ quyết định
scope qua Spec-Kit. Đây là cải thiện kiến trúc theo chuẩn *thật* (assessment
+ ADR + tài liệu) mà không đánh đổi tính toàn vẹn của hệ đang chạy.
