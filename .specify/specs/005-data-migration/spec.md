# Feature Specification: Đợt 5 — Migration Dữ Liệu

**Feature Branch**: `005-data-migration` (stack trên 004)
**Created**: 2026-05-19 · **Status**: Done (surgical) + design follow-up
**Input**: `docs/audit/AUDIT_2026-05-18.md` (S12), roadmap "Thay" §3 (PostgreSQL, MinIO)
**Decision log**: `docs/audit/REMEDIATION_DOT5.md`, `docs/adr/0001-object-storage-abstraction.md`

## Problem

`ApplicationDbContext.OnConfiguring` build `WebApplication.CreateBuilder()` nặng + **hardcode `UseSqlServer`** ⇒ chặn migration Postgres (S12). `ElectionV1StoreDbContext` dùng `EnsureCreated`, không migrations ⇒ cột mới (vd OtpAttemptCount Đợt 2) không thêm được vào DB Postgres đang chạy. Object storage bind cứng Azure Blob (roadmap muốn `IObjectStorage`+MinIO).

## Goal

Mở đường SQL Server → PostgreSQL **không phá hành vi hiện tại**; cho phép EF migrations chuẩn cho store; chốt thiết kế object-storage abstraction. Đo: `dotnet build` 0 error; default vẫn SQL Server khi chưa cấu hình Postgres.

## User Stories

- **US1 (S12)** Bỏ hardcode SqlServer: `OnConfiguring` không tự build host & ghim SqlServer; Program.cs provider-aware cho `ApplicationDbContext` (sniff Postgres như `ElectionV1StoreDbContext` đã làm). **Test**: build 0 error; conn Postgres ⇒ Npgsql, còn lại ⇒ SqlServer (default cũ).
- **US2** EF migrations khả thi cho store: thêm `IDesignTimeDbContextFactory<ElectionV1StoreDbContext>` (Npgsql). **Test**: build 0 error; `dotnet ef migrations add` có factory để chạy (team thực thi với DB thật).
- **US3** Object storage: ADR `IObjectStorage` + lộ trình MinIO (không code swap rủi ro). **Test**: ADR tồn tại, lộ trình PR-nhỏ rõ.

## Requirements

- **FR-001 (S12)**: KHÔNG hardcode `UseSqlServer` ở `OnConfiguring`; provider do DI/config quyết định.
- **FR-002**: `ApplicationDbContext` runtime provider-aware (Postgres khi connection string Postgres); **default SQL Server** (tương thích ngược).
- **FR-003**: Có design-time factory để `dotnet ef migrations` chạy được cho `ElectionV1StoreDbContext`.
- **FR-004**: Object-storage abstraction được thiết kế (ADR) + lộ trình; KHÔNG tạo interface treo / swap không kiểm thử.

## Success Criteria

- **SC-001**: `dotnet build` **0 error**.
- **SC-002**: Không đổi hành vi mặc định (in-memory dev / SQL Server prod) nếu chưa cấu hình Postgres.
- **SC-003**: `IDesignTimeDbContextFactory` biên dịch, chỉ design-time, 0 ảnh hưởng runtime.
- **SC-004**: ADR 0001 mô tả interface + 5 bước migrate verify được.

## Out of Scope (follow-up — ADR/REMEDIATION ghi rõ)

- Sinh file EF migration thật + `database update` (cần DB Postgres để test — team thực thi).
- Triển khai `IObjectStorage`/`MinioObjectStorage` + rewire consumer web2 (refactor có kiểm thử tích hợp).
- Chuyển default toàn hệ sang Postgres/MinIO (big-bang) — làm tăng dần theo ADR.
