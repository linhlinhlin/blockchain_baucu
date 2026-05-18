# REMEDIATION Đợt 5 — Migration Dữ Liệu

- **Spec**: `.specify/specs/005-data-migration/` · **Branch**: `005-data-migration` (stack trên 004) · **Ngày**: 2026-05-19
- **ADR**: `docs/adr/0001-object-storage-abstraction.md`

## S12 — Hardcode UseSqlServer chặn migration Postgres → ĐÃ XỬ LÝ

- `Data/ApplicationDbContext.cs`: bỏ `OnConfiguring` build `WebApplication.CreateBuilder()` + ghim `UseSqlServer`. Provider do DI (Program.cs) / EF host quyết định; OnConfiguring no-op khi đã configured.
- `Program.cs`: đăng ký `ApplicationDbContext` **provider-aware** — `LooksLikePostgresConnectionString(defaultConnection)` ⇒ `UseNpgsql`, ngược lại `UseSqlServer` (mirror logic `ElectionV1StoreDbContext` đã có). **Default SQL Server** ⇒ tương thích ngược; in-memory dev không đổi.

## EF migrations cho ElectionV1Store → ĐÃ MỞ ĐƯỜNG

- Thêm `Data/ElectionV1StoreDbContextFactory.cs` (`IDesignTimeDbContextFactory`, Npgsql) ⇒ `dotnet ef migrations add ... --context ElectionV1StoreDbContext` chạy được. Chỉ design-time, 0 ảnh hưởng runtime.
- Giải quyết gốc hạn chế đã ghi ở Đợt 2 (EnsureCreated không thêm cột mới vào DB cũ): team nay có thể tạo migration chuẩn.
- **Follow-up**: sinh file migration thật + `database update` cần DB Postgres để kiểm thử ⇒ team thực thi (không sinh SQL không test được cho hệ bầu cử).

## Object storage (IObjectStorage / MinIO) → THIẾT KẾ CHỐT (ADR 0001)

Không code swap ở đợt này (consumer web2 coupling cao, không có MinIO/Azure thật để verify ⇒ rủi ro > giá trị; active path ElectionV1 không dùng object storage). ADR 0001 định nghĩa interface `IObjectStorage` + lộ trình 5 bước PR-nhỏ verify được (adapter Azure → refactor từng consumer → MinIO impl → compose service → đổi default). Tránh interface treo (anti-pattern).

## Verify

| Hạng mục | Kết quả |
|---|---|
| `dotnet build` | **0 error** (S12 + factory) |
| Hành vi mặc định | Không đổi (in-memory dev / SQL Server) khi chưa cấu hình Postgres |
| Design-time factory | Compile, chỉ design-time |
| Contracts | Không đụng (npm test 9/9 giữ) |

## Ghi nhận trung thực

S12 (concrete, surgical) đã đóng. Phần "Giai đoạn 5" roadmap còn lại (sinh migration thật, swap MinIO, chuyển default toàn hệ sang Postgres/MinIO) là refactor hạ tầng dữ liệu cần môi trường tích hợp + kiểm thử DB thật — đã thiết kế (ADR + factory + provider-aware) để team thực thi an toàn, không big-bang trong PR không kiểm chứng được (Constitution I/IV).
